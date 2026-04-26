"""
GITPUSH - Advanced GitHub Repository Manager
by dev.sakib

Production-ready Flask backend.
"""
import os
import base64
import time
import logging
from functools import wraps
from threading import Lock

from flask import Flask, jsonify, request, render_template, send_from_directory
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
# Cache static assets aggressively for faster reloads
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 60 * 60 * 24 * 7  # 7 days
CORS(app)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gitpush")

# ── GitHub Token ───────────────────────────────────────────────────────
GITHUB_TOKEN = "ghp_your_token_here"   # ← put your token here OR use env
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
# Repo context (in-memory; single active repo per server instance)
# ---------------------------------------------------------------------------
_ctx_lock = Lock()
_repo_ctx = {"username": FIXED_USERNAME, "repo": None}


def _fresh_repo():
    """Always fetch a fresh repo object so we never serve stale SHAs."""
    with _ctx_lock:
        repo_name = _repo_ctx["repo"]
    if not repo_name:
        raise LookupError("No repository selected. Use 'Change Repo' first.")
    full = f"{FIXED_USERNAME}/{repo_name}"
    return get_gh().get_repo(full)


def set_repo_context(repo_name: str):
    repo_name = (repo_name or "").strip()
    if not repo_name:
        raise ValueError("Repository name is required.")
    if not _is_safe_name(repo_name):
        raise ValueError("Invalid characters in repo name.")
    full = f"{FIXED_USERNAME}/{repo_name}"
    repo_obj = get_gh().get_repo(full)  # validates existence
    with _ctx_lock:
        _repo_ctx["repo"] = repo_name
    return repo_obj


# Backwards-compat alias used throughout the file
get_current_repo = _fresh_repo


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


def _retry_github(fn, retries=4, base_delay=0.4):
    """Retry fn() on transient 409/422/5xx errors."""
    last = None
    for attempt in range(retries):
        try:
            return fn()
        except GithubException as e:
            last = e
            if e.status in (409, 422, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(base_delay * (2 ** attempt))
                continue
            raise
    if last:
        raise last


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
# Routes - File listing & reading
# ---------------------------------------------------------------------------
@app.route("/list-files", methods=["GET"])
@handle_github
def list_files():
    repo = get_current_repo()
    path = request.args.get("path", "").strip().strip("/")
    branch = request.args.get("branch") or repo.default_branch
    if path and not _is_safe_path(path):
        return api_error("Invalid path", 400)

    try:
        contents = repo.get_contents(path or "", ref=branch)
    except GithubException as e:
        if e.status == 404:
            # Path no longer exists (likely after a delete) — fall back to root
            if path:
                contents = repo.get_contents("", ref=branch)
                path = ""
            else:
                # Repo is empty
                return api_ok(path="", branch=branch, items=[], count=0, empty=True)
        else:
            raise

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


@app.route("/list-tree", methods=["GET"])
@handle_github
def list_tree():
    """Return the FULL recursive tree in a single call (faster file explorer)."""
    repo = get_current_repo()
    branch = request.args.get("branch") or repo.default_branch
    try:
        ref = repo.get_git_ref(f"heads/{branch}")
        commit = repo.get_git_commit(ref.object.sha)
        tree = repo.get_git_tree(commit.tree.sha, recursive=True)
    except GithubException as e:
        if e.status in (404, 409):
            return api_ok(branch=branch, items=[], count=0, empty=True)
        raise

    items = []
    for el in tree.tree:
        items.append({
            "path": el.path,
            "name": el.path.rsplit("/", 1)[-1],
            "type": "dir" if el.type == "tree" else "file",
            "size": el.size or 0,
            "sha": el.sha,
        })
    items.sort(key=lambda x: (x["type"] != "dir", x["path"].lower()))
    return api_ok(branch=branch, items=items, count=len(items),
                  truncated=getattr(tree, "truncated", False))


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


# ---------------------------------------------------------------------------
# Routes - Single file create/update/replace
# ---------------------------------------------------------------------------
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
        result = _retry_github(lambda: repo.update_file(
            path=path, message=message, content=raw,
            sha=existing.sha, branch=branch))
        action = "update"
    else:
        result = _retry_github(lambda: repo.create_file(
            path=path, message=message, content=raw, branch=branch))
        action = "create"

    return api_ok(action=action,
                  message=f"{action.capitalize()}d {path}",
                  commit=result["commit"].sha,
                  path=path)


@app.route("/replace-file", methods=["POST"])
@handle_github
def replace_file():
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
    result = _retry_github(lambda: repo.update_file(
        path=path, message=message, content=raw,
        sha=existing.sha, branch=branch))
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

    result = _retry_github(lambda: repo.delete_file(
        path=path, message=message, sha=existing.sha, branch=branch))
    return api_ok(action="delete",
                  message=f"Deleted {path}",
                  commit=result["commit"].sha,
                  path=path)


# ---------------------------------------------------------------------------
# Atomic folder upload — Git Tree API (like git push)
# ---------------------------------------------------------------------------
@app.route("/upload-folder-atomic", methods=["POST"])
@handle_github
def upload_folder_atomic():
    """Upload ALL files in ONE single commit using Git Tree API."""
    repo = get_current_repo()
    body = request.get_json(silent=True) or {}

    files     = body.get("files") or []
    base_dir  = (body.get("base_dir") or "").strip().strip("/")
    branch    = body.get("branch") or repo.default_branch
    message   = (body.get("message") or "GITPUSH: upload folder").strip()

    if not isinstance(files, list) or not files:
        return api_error("`files` must be a non-empty list", 400)

    elements = []
    for f in files:
        rel  = (f.get("path") or "").strip()
        b64  = f.get("content", "")
        full = f"{base_dir}/{rel}" if base_dir else rel
        full = "/".join(p for p in full.split("/") if p)
        if not full or not _is_safe_path(full):
            return api_error(f"Invalid path: {full!r}", 400)
        try:
            raw_bytes = base64.b64decode(b64)
        except Exception:
            return api_error(f"Invalid base64 for {full}", 400)
        blob = repo.create_git_blob(
            base64.b64encode(raw_bytes).decode("ascii"), "base64")
        elements.append(InputGitTreeElement(
            path=full, mode="100644", type="blob", sha=blob.sha))

    if not elements:
        return api_error("No valid files to upload", 400)

    def commit_once():
        ref         = repo.get_git_ref(f"heads/{branch}")
        base_commit = repo.get_git_commit(ref.object.sha)
        base_tree   = base_commit.tree
        new_tree    = repo.create_git_tree(elements, base_tree=base_tree)
        new_commit  = repo.create_git_commit(message, new_tree, [base_commit])
        ref.edit(new_commit.sha)
        return new_commit

    new_commit = _retry_github(commit_once)
    log.info("Atomic upload: %d files → %s (%s)",
             len(elements), branch, new_commit.sha[:7])
    return api_ok(
        action="atomic_upload",
        commit=new_commit.sha,
        files_count=len(elements),
        branch=branch,
        message=f"Uploaded {len(elements)} file(s) in 1 commit",
    )


# ---------------------------------------------------------------------------
# Bulk delete (atomic)
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

    def commit_once():
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
            return None  # nothing matched

        new_tree   = repo.create_git_tree(kept) if kept else repo.get_git_tree(EMPTY_TREE_SHA)
        new_commit = repo.create_git_commit(message, new_tree, [base_commit])
        ref.edit(new_commit.sha)
        return {"deleted": deleted, "kept": len(kept), "commit": new_commit.sha}

    result = _retry_github(commit_once)
    if result is None:
        return api_error("No matching files found.", 404)

    return api_ok(
        action="bulk_delete",
        deleted=result["deleted"],
        count=len(result["deleted"]),
        kept=result["kept"],
        commit=result["commit"],
        message=f"Deleted {len(result['deleted'])} file(s) in 1 commit",
    )


# ---------------------------------------------------------------------------
# DELETE ALL — preserves README only, never leaves .gitkeep
# ---------------------------------------------------------------------------
@app.route("/delete-all", methods=["POST"])
@handle_github
def delete_all():
    """
    Wipe everything in the repository in a single commit.
    - Preserves README at the repo root if one exists (any case, any extension).
    - Otherwise leaves the repo with an empty tree (no .gitkeep, no junk).
    """
    repo = get_current_repo()
    body    = request.get_json(silent=True) or {}
    branch  = body.get("branch") or repo.default_branch
    message = (body.get("message") or "GITPUSH: full repository cleanup").strip()

    def commit_once():
        ref         = repo.get_git_ref(f"heads/{branch}")
        base_commit = repo.get_git_commit(ref.object.sha)
        tree        = repo.get_git_tree(base_commit.tree.sha, recursive=True)

        # Find ROOT-level README to preserve (case-insensitive)
        readme_blob = None
        for el in tree.tree:
            if el.type != "blob":
                continue
            if "/" in el.path:
                continue  # only root-level files
            base = el.path.lower()
            if base == "readme" or base.startswith("readme."):
                readme_blob = el
                break

        blobs = [el for el in tree.tree if el.type == "blob"]
        total = len(blobs)
        # Nothing to do?
        if total == 0:
            return {"already_clean": True, "deleted_count": 0, "commit": None}
        if total == 1 and readme_blob is not None:
            return {"already_clean": True, "deleted_count": 0, "commit": None,
                    "kept_readme": readme_blob.path}

        # Build the new tree
        if readme_blob is not None:
            elements = [InputGitTreeElement(
                path=readme_blob.path,
                mode=readme_blob.mode,
                type="blob",
                sha=readme_blob.sha,
            )]
            new_tree = repo.create_git_tree(elements)
            deleted = total - 1
        else:
            # Use empty tree SHA — leaves repo completely clean (no .gitkeep)
            new_tree = repo.get_git_tree(EMPTY_TREE_SHA)
            deleted = total

        new_commit = repo.create_git_commit(message, new_tree, [base_commit])
        ref.edit(new_commit.sha)
        return {
            "already_clean": False,
            "deleted_count": deleted,
            "commit": new_commit.sha,
            "kept_readme": readme_blob.path if readme_blob else None,
        }

    res = _retry_github(commit_once)

    if res.get("already_clean"):
        return api_ok(
            action="delete_all",
            deleted_count=0,
            already_clean=True,
            kept_readme=res.get("kept_readme"),
            message="Repository is already clean.",
        )

    return api_ok(
        action="delete_all",
        deleted_count=res["deleted_count"],
        kept_readme=res.get("kept_readme"),
        commit=res["commit"],
        message=(
            f"Wiped {res['deleted_count']} file(s)"
            + (f" — preserved {res['kept_readme']}" if res.get("kept_readme") else "")
        ),
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


# Known API endpoint prefixes so 404 handler returns JSON, not HTML
_API_PREFIXES = (
    "/repo-context", "/change-repo", "/repo-info", "/git-status",
    "/list-files", "/list-tree", "/read-file", "/upload-file",
    "/upload-folder-atomic", "/replace-file", "/delete-file",
    "/delete-many", "/delete-all", "/branches", "/health",
)


@app.errorhandler(404)
def not_found(_):
    p = request.path or ""
    if p.startswith(_API_PREFIXES):
        return api_error("Endpoint not found", 404)
    # SPA-style fallback
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
