"""
GITPUSH - Advanced GitHub Repository Manager
by dev.sakib
"""
import os
import base64
import time
import logging
from functools import wraps
from threading import Lock

from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from github import Github, GithubException, Auth, InputGitTreeElement
from dotenv import load_dotenv

EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

load_dotenv()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FIXED_USERNAME = "abysss-sakib"

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "gitpush-dev-secret")
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB
app.config["JSON_SORT_KEYS"] = False
CORS(app)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gitpush")

# ── GitHub Token — এখানে তোমার token বসাও ──────────────────────────────
GITHUB_TOKEN = "ghp_your_token_here"   # ← এই লাইনে token দাও
# যদি উপরে না দাও, তাহলে .env / Render env থেকে নেবে
if not GITHUB_TOKEN or GITHUB_TOKEN == "ghp_your_token_here":
    GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    log.warning("GITHUB_TOKEN is not set. API calls will fail.")

# ---------------------------------------------------------------------------
# GitHub client
# ---------------------------------------------------------------------------
_gh_lock = Lock()
_gh_client = None


def get_gh():
    global _gh_client
    with _gh_lock:
        if _gh_client is None:
            if not GITHUB_TOKEN:
                raise RuntimeError("GITHUB_TOKEN is not configured on the server")
            _gh_client = Github(auth=Auth.Token(GITHUB_TOKEN),
                                per_page=100,
                                timeout=30,
                                retry=3)
        return _gh_client


# ---------------------------------------------------------------------------
# Repo context
# ---------------------------------------------------------------------------
_ctx_lock = Lock()
_repo_ctx = {"username": FIXED_USERNAME, "repo": None}
_repo_cache = {}


def set_repo_context(repo_name: str):
    repo_name = (repo_name or "").strip()
    if not repo_name:
        raise ValueError("Repository name is required.")
    if not _is_safe_name(repo_name):
        raise ValueError("Invalid characters in repo name.")
    full = f"{FIXED_USERNAME}/{repo_name}"
    repo_obj = get_gh().get_repo(full)
    with _ctx_lock:
        _repo_ctx["repo"] = repo_name
        _repo_cache[full] = repo_obj
    return repo_obj


def get_current_repo():
    with _ctx_lock:
        repo_name = _repo_ctx["repo"]
    if not repo_name:
        raise LookupError("No repository selected. Use 'Change Repo' first.")
    full = f"{FIXED_USERNAME}/{repo_name}"
    if full in _repo_cache:
        return _repo_cache[full]
    repo_obj = get_gh().get_repo(full)
    _repo_cache[full] = repo_obj
    return repo_obj


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _is_safe_name(value: str) -> bool:
    if not value or len(value) > 100:
        return False
    return all(c.isalnum() or c in "-_." for c in value)


def _is_safe_path(path: str) -> bool:
    if not path or len(path) > 500:
        return False
    if path.startswith("/") or ".." in path.split("/"):
        return False
    return True


def api_error(message, status=400, **extra):
    payload = {"ok": False, "error": message}
    payload.update(extra)
    return jsonify(payload), status


def api_ok(**data):
    return jsonify({"ok": True, **data})


def handle_github(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except LookupError as e:
            return api_error(str(e), 404)
        except ValueError as e:
            return api_error(str(e), 400)
        except GithubException as e:
            msg = "GitHub API error"
            if isinstance(e.data, dict):
                msg = e.data.get("message", msg)
            return api_error(msg, e.status or 502)
        except RuntimeError as e:
            return api_error(str(e), 500)
        except Exception as e:
            log.exception("Unexpected error")
            return api_error(f"Server error: {e}", 500)
    return wrapper


# ---------------------------------------------------------------------------
# Routes - UI
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html", fixed_username=FIXED_USERNAME)


@app.route("/health")
def health():
    return api_ok(service="gitpush", status="alive", username=FIXED_USERNAME)


# ---------------------------------------------------------------------------
# Routes - Repo context
# ---------------------------------------------------------------------------
@app.route("/repo-context", methods=["GET"])
def repo_context():
    with _ctx_lock:
        return api_ok(context=dict(_repo_ctx), fixed_username=FIXED_USERNAME)


@app.route("/change-repo", methods=["POST"])
@handle_github
def change_repo():
    body = request.get_json(silent=True) or {}
    repo_name = body.get("repo")
    repo_obj = set_repo_context(repo_name)
    return api_ok(
        message=f"Connected to {repo_obj.full_name}",
        repo={
            "name": repo_obj.name,
            "full_name": repo_obj.full_name,
            "default_branch": repo_obj.default_branch,
        },
    )


# ---------------------------------------------------------------------------
# Routes - Repo info & status
# ---------------------------------------------------------------------------
@app.route("/repo-info", methods=["GET"])
@handle_github
def repo_info():
    repo = get_current_repo()
    return api_ok(info={
        "name": repo.name,
        "full_name": repo.full_name,
        "description": repo.description or "",
        "owner": repo.owner.login,
        "stars": repo.stargazers_count,
        "forks": repo.forks_count,
        "watchers": repo.watchers_count,
        "open_issues": repo.open_issues_count,
        "size_kb": repo.size,
        "language": repo.language or "—",
        "default_branch": repo.default_branch,
        "created_at": repo.created_at.isoformat() if repo.created_at else None,
        "updated_at": repo.updated_at.isoformat() if repo.updated_at else None,
        "pushed_at": repo.pushed_at.isoformat() if repo.pushed_at else None,
        "html_url": repo.html_url,
        "private": repo.private,
        "license": repo.license.name if repo.license else None,
    })


@app.route("/git-status", methods=["GET"])
@handle_github
def git_status():
    repo = get_current_repo()
    branch = request.args.get("branch") or repo.default_branch
    limit = min(int(request.args.get("limit", 15)), 50)
    commits_iter = repo.get_commits(sha=branch)[:limit]
    commits = []
    for c in commits_iter:
        author = c.commit.author
        commits.append({
            "sha": c.sha,
            "short_sha": c.sha[:7],
            "message": (c.commit.message or "").split("\n")[0],
            "author": author.name if author else "unknown",
            "email": author.email if author else "",
            "date": author.date.isoformat() if author and author.date else None,
            "html_url": c.html_url,
        })
    return api_ok(branch=branch, commits=commits, count=len(commits))


# ---------------------------------------------------------------------------
# Routes - File operations
# ---------------------------------------------------------------------------
@app.route("/list-files", methods=["GET"])
@handle_github
def list_files():
    repo = get_current_repo()
    path = request.args.get("path", "").strip()
    branch = request.args.get("branch") or repo.default_branch
    if path and not _is_safe_path(path):
        return api_error("Invalid path", 400)
    contents = repo.get_contents(path or "", ref=branch)
    if not isinstance(contents, list):
        contents = [contents]
    items = [{
        "name": c.name,
        "path": c.path,
        "type": c.type,
        "size": c.size,
        "sha": c.sha,
        "download_url": c.download_url,
        "html_url": c.html_url,
    } for c in contents]
    items.sort(key=lambda x: (x["type"] != "dir", x["name"].lower()))
    return api_ok(path=path, branch=branch, items=items, count=len(items))


@app.route("/read-file", methods=["GET"])
@handle_github
def read_file():
    repo = get_current_repo()
    path = request.args.get("path", "").strip()
    branch = request.args.get("branch") or repo.default_branch
    if not _is_safe_path(path):
        return api_error("Invalid file path", 400)
    file_obj = repo.get_contents(path, ref=branch)
    if isinstance(file_obj, list):
        return api_error("Path is a directory, not a file", 400)
    try:
        decoded = file_obj.decoded_content.decode("utf-8")
        is_binary = False
    except UnicodeDecodeError:
        decoded = base64.b64encode(file_obj.decoded_content).decode("ascii")
        is_binary = True
    return api_ok(file={
        "path": file_obj.path,
        "name": file_obj.name,
        "size": file_obj.size,
        "sha": file_obj.sha,
        "branch": branch,
        "encoding": "base64" if is_binary else "utf-8",
        "is_binary": is_binary,
        "content": decoded,
        "html_url": file_obj.html_url,
    })


@app.route("/upload-file", methods=["POST"])
@handle_github
def upload_file():
    """Create OR update a single file (upsert)."""
    repo = get_current_repo()
    body = request.get_json(silent=True) or {}
    path = (body.get("path") or "").strip()
    content = body.get("content", "")
    message = (body.get("message") or f"GITPUSH: upload {path}").strip()
    branch = body.get("branch") or repo.default_branch
    is_base64 = bool(body.get("is_base64", False))
    overwrite = body.get("overwrite", True)

    if not _is_safe_path(path):
        return api_error("Invalid file path", 400)

    raw = base64.b64decode(content) if is_base64 else content.encode("utf-8")

    existing = None
    try:
        existing = repo.get_contents(path, ref=branch)
        if isinstance(existing, list):
            return api_error("Path is a directory", 400)
    except GithubException as e:
        if e.status != 404:
            raise

    if existing and not overwrite:
        return api_error("File already exists", 409)

    if existing:
        result = repo.update_file(path=path, message=message,
                                  content=raw, sha=existing.sha,
                                  branch=branch)
        action = "update"
    else:
        result = repo.create_file(path=path, message=message,
                                  content=raw, branch=branch)
        action = "create"

    return api_ok(action=action,
                  message=f"{action.capitalize()}d {path}",
                  commit=result["commit"].sha,
                  path=path)


@app.route("/replace-file", methods=["POST"])
@handle_github
def replace_file():
    """Replace an existing file."""
    repo = get_current_repo()
    body = request.get_json(silent=True) or {}
    path = (body.get("path") or "").strip()
    content = body.get("content", "")
    message = (body.get("message") or f"GITPUSH: replace {path}").strip()
    branch = body.get("branch") or repo.default_branch
    is_base64 = bool(body.get("is_base64", False))

    if not _is_safe_path(path):
        return api_error("Invalid file path", 400)

    existing = repo.get_contents(path, ref=branch)
    if isinstance(existing, list):
        return api_error("Path is a directory", 400)

    raw = base64.b64decode(content) if is_base64 else content.encode("utf-8")
    result = repo.update_file(path=path, message=message,
                              content=raw, sha=existing.sha,
                              branch=branch)
    return api_ok(action="replace",
                  message=f"Replaced {path}",
                  commit=result["commit"].sha,
                  path=path)


@app.route("/delete-file", methods=["POST"])
@handle_github
def delete_file():
    repo = get_current_repo()
    body = request.get_json(silent=True) or {}
    path = (body.get("path") or "").strip()
    message = (body.get("message") or f"GITPUSH: delete {path}").strip()
    branch = body.get("branch") or repo.default_branch

    if not _is_safe_path(path):
        return api_error("Invalid file path", 400)

    existing = repo.get_contents(path, ref=branch)
    if isinstance(existing, list):
        return api_error("Path is a directory", 400)

    result = repo.delete_file(path=path, message=message,
                              sha=existing.sha, branch=branch)
    return api_ok(action="delete",
                  message=f"Deleted {path}",
                  commit=result["commit"].sha,
                  path=path)


# ---------------------------------------------------------------------------
# NEW: Atomic folder upload — Git Tree API (like git push)
# ---------------------------------------------------------------------------
@app.route("/upload-folder-atomic", methods=["POST"])
@handle_github
def upload_folder_atomic():
    """
    Upload ALL files in ONE single commit using Git Tree API.
    Exactly like: git add . && git commit -m "msg" && git push

    Body (JSON):
    {
        "files": [
            { "path": "src/index.js",   "content": "<base64>" },
            { "path": ".gitignore",     "content": "<base64>" },
            { "path": "assets/img.png", "content": "<base64>" }
        ],
        "base_dir": "optional/prefix",   // optional
        "message":  "my commit message", // optional
        "branch":   "main"               // optional
    }

    Returns: { ok, commit, files_count, branch }
    """
    repo = get_current_repo()
    body = request.get_json(silent=True) or {}

    files     = body.get("files") or []
    base_dir  = (body.get("base_dir") or "").strip().strip("/")
    branch    = body.get("branch") or repo.default_branch
    message   = (body.get("message") or "GITPUSH: upload folder").strip()

    if not isinstance(files, list) or not files:
        return api_error("`files` must be a non-empty list", 400)

    # Build blob elements
    elements = []
    for f in files:
        rel  = (f.get("path") or "").strip()
        b64  = f.get("content", "")

        # Build full repo path
        if base_dir:
            full = f"{base_dir}/{rel}"
        else:
            full = rel
        # Normalise
        full = "/".join(p for p in full.split("/") if p)

        if not full or not _is_safe_path(full):
            return api_error(f"Invalid path: {full!r}", 400)

        try:
            raw_bytes = base64.b64decode(b64)
        except Exception:
            return api_error(f"Invalid base64 for {full}", 400)

        # Create a blob for this file
        blob = repo.create_git_blob(
            base64.b64encode(raw_bytes).decode("ascii"),
            "base64"
        )
        elements.append(InputGitTreeElement(
            path=full,
            mode="100644",
            type="blob",
            sha=blob.sha,
        ))

    if not elements:
        return api_error("No valid files to upload", 400)

    # Get current HEAD
    MAX_RETRIES = 4
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            ref         = repo.get_git_ref(f"heads/{branch}")
            base_commit = repo.get_git_commit(ref.object.sha)
            base_tree   = base_commit.tree

            # Create new tree on top of existing tree (keeps unrelated files)
            new_tree   = repo.create_git_tree(elements, base_tree=base_tree)
            new_commit = repo.create_git_commit(message, new_tree, [base_commit])
            ref.edit(new_commit.sha)

            log.info("Atomic upload: %d files → %s (%s)",
                     len(elements), branch, new_commit.sha[:7])

            return api_ok(
                action="atomic_upload",
                commit=new_commit.sha,
                files_count=len(elements),
                branch=branch,
                message=f"Uploaded {len(elements)} file(s) in 1 commit",
            )
        except GithubException as e:
            if e.status in (409, 422) and attempt < MAX_RETRIES - 1:
                last_err = e
                time.sleep(0.5 * (2 ** attempt))
                continue
            raise

    raise last_err if last_err else GithubException(500, "Atomic upload failed", None)


# ---------------------------------------------------------------------------
# Legacy per-file upload (kept for single-file upload button)
# ---------------------------------------------------------------------------
@app.route("/upload-folder", methods=["POST"])
@handle_github
def upload_folder():
    """Single file upload (legacy, used by Upload File button)."""
    repo = get_current_repo()
    body = request.get_json(silent=True) or {}
    rel_path    = (body.get("path") or "").strip()
    base_dir    = (body.get("base_dir") or "").strip().strip("/")
    content_b64 = body.get("content", "")
    branch      = body.get("branch") or repo.default_branch

    full_path = f"{base_dir}/{rel_path}" if base_dir else rel_path
    full_path = "/".join(p for p in full_path.split("/") if p)

    if not full_path:
        return api_error("File path is empty", 400)
    if not _is_safe_path(full_path):
        return api_error(f"Invalid path: {full_path}", 400)

    message = (body.get("message") or f"GITPUSH: upload {full_path}").strip()

    try:
        raw = base64.b64decode(content_b64)
    except Exception:
        return api_error("Invalid base64 content", 400)

    MAX_RETRIES = 6
    last_err = None
    for attempt in range(MAX_RETRIES):
        existing = None
        try:
            existing = repo.get_contents(full_path, ref=branch)
            if isinstance(existing, list):
                return api_error(f"Path is a directory: {full_path}", 400)
        except GithubException as e:
            if e.status != 404:
                raise

        try:
            if existing:
                result = repo.update_file(path=full_path, message=message,
                                          content=raw, sha=existing.sha,
                                          branch=branch)
                action = "update"
            else:
                result = repo.create_file(path=full_path, message=message,
                                          content=raw, branch=branch)
                action = "create"
            return api_ok(action=action,
                          path=full_path,
                          size=len(raw),
                          commit=result["commit"].sha,
                          retries=attempt)
        except GithubException as e:
            if e.status in (409, 422) and attempt < MAX_RETRIES - 1:
                last_err = e
                time.sleep(0.3 * (2 ** attempt))
                continue
            raise

    raise last_err if last_err else GithubException(500, "Upload failed", None)


# ---------------------------------------------------------------------------
# Delete operations
# ---------------------------------------------------------------------------
@app.route("/delete-many", methods=["POST"])
@handle_github
def delete_many():
    """Atomically delete files/folders in ONE commit."""
    repo = get_current_repo()
    body = request.get_json(silent=True) or {}
    raw_paths = body.get("paths") or []
    recursive = bool(body.get("recursive", True))
    branch    = body.get("branch") or repo.default_branch

    if not isinstance(raw_paths, list) or not raw_paths:
        return api_error("`paths` must be a non-empty list", 400)

    paths = []
    for p in raw_paths:
        p = (p or "").strip().strip("/")
        if not p or not _is_safe_path(p):
            return api_error(f"Invalid path: {p}", 400)
        paths.append(p)
    paths = list(dict.fromkeys(paths))

    message = (body.get("message")
               or f"GITPUSH: bulk delete ({len(paths)} entr"
               + ("y" if len(paths) == 1 else "ies") + ")").strip()

    delete_exact    = set(paths)
    delete_prefixes = tuple(f"{p}/" for p in paths) if recursive else ()

    MAX_RETRIES = 4
    last_err = None
    for attempt in range(MAX_RETRIES):
        ref         = repo.get_git_ref(f"heads/{branch}")
        base_commit = repo.get_git_commit(ref.object.sha)
        tree        = repo.get_git_tree(base_commit.tree.sha, recursive=True)

        deleted, kept = [], []
        for el in tree.tree:
            if el.type != "blob":
                continue
            if el.path in delete_exact or (recursive and el.path.startswith(delete_prefixes)):
                deleted.append(el.path)
            else:
                kept.append(InputGitTreeElement(
                    path=el.path, mode=el.mode, type="blob", sha=el.sha))

        if not deleted:
            return api_error("No matching files found.", 404)

        try:
            new_tree   = repo.create_git_tree(kept) if kept else repo.get_git_tree(EMPTY_TREE_SHA)
            new_commit = repo.create_git_commit(message, new_tree, [base_commit])
            ref.edit(new_commit.sha)
            return api_ok(
                action="bulk_delete",
                deleted=deleted,
                count=len(deleted),
                kept=len(kept),
                commit=new_commit.sha,
                retries=attempt,
                message=f"Deleted {len(deleted)} file(s) in 1 commit",
            )
        except GithubException as e:
            if e.status in (409, 422) and attempt < MAX_RETRIES - 1:
                last_err = e
                time.sleep(0.3 * (2 ** attempt))
                continue
            raise

    raise last_err if last_err else GithubException(500, "Bulk delete failed", None)


@app.route("/delete-all", methods=["POST"])
@handle_github
def delete_all():
    """Wipe entire repo tree in a single commit."""
    repo = get_current_repo()
    body    = request.get_json(silent=True) or {}
    branch  = body.get("branch") or repo.default_branch
    confirm = (body.get("confirm") or "").strip()
    if confirm != "DELETE ALL":
        return api_error('Confirmation required: send {"confirm":"DELETE ALL"}', 400)

    message = (body.get("message") or "GITPUSH: full repository cleanup").strip()

    ref         = repo.get_git_ref(f"heads/{branch}")
    base_commit = repo.get_git_commit(ref.object.sha)
    tree        = repo.get_git_tree(base_commit.tree.sha, recursive=True)
    blob_count  = sum(1 for el in tree.tree if el.type == "blob")

    if blob_count == 0:
        return api_error("Repository is already empty", 400)

    try:
        empty_tree = repo.get_git_tree(EMPTY_TREE_SHA)
        new_commit = repo.create_git_commit(message, empty_tree, [base_commit])
    except GithubException:
        elements   = [InputGitTreeElement(path=".gitkeep", mode="100644", type="blob", content="")]
        new_tree   = repo.create_git_tree(elements)
        new_commit = repo.create_git_commit(message, new_tree, [base_commit])

    ref.edit(new_commit.sha)
    return api_ok(
        action="delete_all",
        deleted_count=blob_count,
        commit=new_commit.sha,
        message=f"Wiped {blob_count} file(s) from {repo.full_name}",
    )


@app.route("/branches", methods=["GET"])
@handle_github
def branches():
    repo = get_current_repo()
    return api_ok(
        branches=[{"name": b.name, "protected": b.protected}
                  for b in repo.get_branches()],
        default=repo.default_branch,
    )


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.errorhandler(413)
def too_large(_):
    return api_error("Upload too large (max 500MB)", 413)


@app.errorhandler(404)
def not_found(_):
    if request.path.startswith("/api") or "-" in request.path.lstrip("/"):
        return api_error("Endpoint not found", 404)
    return render_template("index.html", fixed_username=FIXED_USERNAME), 200


@app.errorhandler(500)
def server_error(_):
    log.exception("500 error")
    return api_error("Internal server error", 500)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    log.info(f"GITPUSH starting on 0.0.0.0:{port} (user={FIXED_USERNAME})")
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
