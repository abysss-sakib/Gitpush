# GITPUSH

> Production-ready GitHub Repository Manager for `abysss-sakib`.
> Built by **dev.sakib** with Flask + PyGithub + a glassmorphism vanilla-JS dashboard.

GITPUSH is a single-page web app that lets you list, read, upload, replace, and **bulk-delete** files in any GitHub repository owned by a fixed user — using only your repository name. The GitHub username is hardcoded on the backend, so the UI never asks for it.

---

## Table of Contents

1. [Project overview](#1-project-overview)
2. [Feature list](#2-feature-list)
3. [How the upload system works](#3-how-the-upload-system-works)
4. [How the delete system works](#4-how-the-delete-system-works)
5. [Project structure](#5-project-structure)
6. [What you can edit / what you must NOT change](#6-what-you-can-edit--what-you-must-not-change)
7. [Local development](#7-local-development)
8. [Environment variables](#8-environment-variables)
9. [Deploying on Render — step by step](#9-deploying-on-render--step-by-step)
10. [API reference](#10-api-reference)
11. [Security model](#11-security-model)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Project overview

GITPUSH is a self-hosted dashboard for one GitHub user (`abysss-sakib`). You log in once with a GitHub Personal Access Token on the **server** (never the browser), pick a repository name, and from then on you can:

- Browse the repo's file tree like a mini IDE
- Upload single files, multiple files, or whole folders (with subfolders)
- Replace, read, or delete any file
- **Bulk-delete** many files / folders / nested folders in **one atomic commit**
- **DELETE ALL** — wipe the entire working tree of the repository in one commit
- View live repo stats (stars, forks, size, last push) and recent commits (Git Status)

The backend is **Flask + PyGithub**. The frontend is **vanilla HTML / CSS / JS** with a glassmorphism dark/light theme. There is no build step — what you see in `static/` is what runs.

---

## 2. Feature list

| Category | Feature |
| --- | --- |
| **Auth** | GitHub PAT stored only as `GITHUB_TOKEN` env var. Username `abysss-sakib` hardcoded. |
| **Repo control** | Switch repo at any time, no restart. Live stats (stars/forks/size/last push). |
| **Files** | List directories with breadcrumbs, read text/binary, view code with syntax-friendly viewer. |
| **Upload** | (a) single/multi file upload (b) whole-folder upload preserving subfolders (c) per-file progress UI with ✓/✕/↻ icons (d) 3-way concurrent uploads. |
| **Replace** | Pre-fills the current file content in an editor; commit on save. |
| **Delete** | Single file, single folder (recursive), multi-select bulk delete (atomic single-commit), and "**DELETE ALL**" (wipes the whole tree). |
| **Git Status** | Latest commits with author, time, SHA links to GitHub. |
| **UX** | Glassmorphism + neon accents, dark/light toggle, responsive, animations, toasts, modals, loading overlay. |
| **Deploy** | One-click Render via `render.yaml` + `Procfile`. |

---

## 3. How the upload system works

There are **two upload buttons** in the dashboard:

### Upload File (multi-file)
- Click **Upload File**.
- The browser opens a **multi-select** file picker (you can hold ⌘/Ctrl/Shift to pick many files).
- A modal asks for an optional **target directory** in the repo (defaults to the directory you are currently browsing) and a commit message prefix.
- All selected files are uploaded one by one, with a live per-file progress list (3 in parallel). Each file becomes its own commit so you can re-run on failures.

### Upload Folder (recursive)
- Click **Upload Folder**.
- The browser opens a folder picker (`webkitdirectory`).
- The frontend reads **every file inside the folder, including all subfolders, recursively** (just like a Termux file-share would).
- A modal lets you pick the destination directory in the repo (defaults to the folder name).
- The folder structure is preserved on GitHub — `assets/img/logo.png` stays as `assets/img/logo.png` under your chosen target path.
- Uploads run with 3-worker concurrency and per-file progress.

### Backend mechanics
Both buttons funnel into the same loop, calling `POST /upload-folder` once per file (base64-encoded). The backend upserts each file (creates if missing, updates if it already exists). Per-file commits are intentional — if one file fails you can see exactly which one and retry without losing progress.

---

## 4. How the delete system works

GITPUSH supports four deletion modes. **All deletions go through the GitHub Git Data API**, which means bulk operations are **atomic single commits** (no partial-failure / race conditions).

### a) Single file delete
- In the file list, click **Delete** on a file row, **or** use the **Delete File** action button and type a path.
- Confirms with a commit message, then deletes via `/delete-many`.

### b) Single folder delete (recursive)
- In the file list, click **Delete** on a directory row.
- Recursively deletes every blob under that folder in one commit.
- A `recursive` badge is shown in the confirmation modal.

### c) Multi-select bulk delete
- Each row in the file list has a checkbox. Use the **Select all** checkbox at the top to grab everything in the current directory.
- The toolbar shows "Delete Selected (N)". Click it.
- Files **and** folders can be mixed — folders are auto-recursed.
- All deletions land in **one commit**, atomically. You will not get a half-deleted state.

### d) DELETE ALL
- The **⚠ DELETE ALL** button (top-right of the file toolbar) wipes the entire working tree of the active branch.
- Requires you to type the phrase **`DELETE ALL`** to confirm.
- The new commit points to the universal Git "empty tree" (`4b825dc6…`). History is preserved — you can revert from `git log` if needed.

> **Why atomic?** Earlier versions deleted files one at a time via `repo.delete_file()`, which sometimes left orphans on rate-limit hiccups. The new `/delete-many` and `/delete-all` endpoints build a new Git tree without the deleted blobs and create one commit pointing to it. Reliable for any number of files.

---

## 5. Project structure

```
GITPUSH/
├── app.py                  # Flask backend (all API routes)
├── templates/
│   └── index.html          # Dashboard markup
├── static/
│   ├── css/style.css       # Theming + layout (glassmorphism, dark/light)
│   └── js/app.js           # Front-end controller (UI logic, fetch calls)
├── requirements.txt        # Python deps (Flask, PyGithub, etc.)
├── render.yaml             # Render blueprint (web service)
├── Procfile                # Heroku/Render fallback start command (gunicorn)
├── .env.example            # Template of required env vars
├── .gitignore
└── README.md               # This file
```

---

## 6. What you can edit / what you must NOT change

### ✅ Safe to customize

| File | What to change |
| --- | --- |
| `static/css/style.css` | Colors, fonts, spacing, animations. Theme variables live at the top under `:root` and `[data-theme="light"]`. |
| `templates/index.html` | Brand text, action button labels/icons, footer, meta tags. |
| `static/js/app.js` | UI behavior — modals, prompts, table layout, panel rendering. |
| `README.md` | Your own deployment notes. |
| `requirements.txt` | Add Python deps. |

### ⚠️ Change with care

| File | Why |
| --- | --- |
| `app.py` `FIXED_USERNAME` constant | Change this if you want a different GitHub user. Make sure your `GITHUB_TOKEN` has access to that user's repos. |
| `app.py` route paths | The frontend `static/js/app.js` calls these by name. Renaming a route requires updating both. |
| `app.py` `_is_safe_path` / `_is_safe_name` | These are security guards. Loosening them can let users escape the repo path. |

### 🚫 Do NOT change

| File | Reason |
| --- | --- |
| `EMPTY_TREE_SHA` constant in `app.py` | This is Git's universal empty-tree SHA (`4b825dc6…`). It is not a value you invent — it must remain exactly this string. |
| `Procfile` start command port (`$PORT`) | Render injects `PORT`. Hardcoding a port will break deployment. |
| The `MAX_CONTENT_LENGTH = 100 * 1024 * 1024` cap | If raised significantly you'll hit GitHub API limits and Render's request size cap. |

---

## 7. Local development

### Prerequisites
- Python 3.11+
- A GitHub Personal Access Token with `repo` scope ([create one](https://github.com/settings/tokens?type=beta))

### Setup
```bash
git clone <your repo>
cd gitpush
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your GITHUB_TOKEN
python app.py
```
Open <http://localhost:5000>.

### How to use
1. Click **Change Repo** in the top-right.
2. Type a repo name (just the name, no slash, no username).
3. The dashboard auto-loads stats and the file tree.
4. Use the action buttons to upload, edit, or delete.

---

## 8. Environment variables

| Variable | Required | Default | Description |
| --- | :---: | --- | --- |
| `GITHUB_TOKEN` | ✅ | — | Personal Access Token with `repo` scope. |
| `SECRET_KEY` | ❌ | `gitpush-dev-secret` | Flask session secret. Set on Render for security. |
| `PORT` | ❌ | `5000` | Server port. Render injects this automatically. |
| `FLASK_DEBUG` | ❌ | `0` | Set to `1` for verbose dev logs. |

---

## 9. Deploying on Render — step by step

### Option A: One-click via `render.yaml` (recommended)

1. Push this project to a **GitHub repository** of your own.
2. Sign in at <https://render.com>.
3. Click **New +** → **Blueprint**.
4. Select your GitHub repo. Render detects `render.yaml` automatically.
5. On the next screen Render asks you to set the unset env vars:
   - **`GITHUB_TOKEN`** — paste your PAT. Mark as **Secret**.
   - `SECRET_KEY` is auto-generated by Render (per the blueprint).
6. Click **Apply**.
7. Wait for the first build. Status: **Live**.
8. Open the URL Render gives you (e.g. `https://gitpush.onrender.com`).
9. Click **Change Repo** in the dashboard, type a repo name owned by `abysss-sakib`, and you're in.

### Option B: Manual web service

1. Render → **New +** → **Web Service**.
2. Connect your GitHub repo.
3. Use these settings:
   - **Environment**: Python
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `python app.py`
   - **Plan**: Free is fine to start.
4. Add environment variables:
   - `GITHUB_TOKEN` = `ghp_xxx…` (your PAT)
   - `PYTHON_VERSION` = `3.11.9` (matches `render.yaml`)
   - `SECRET_KEY` = any long random string
5. Create the service. Wait for **Live** status.

### Notes for Render free plan
- Free instances spin down after 15 minutes of inactivity. The first request after that takes 30–60 seconds.
- Render assigns a dynamic `PORT` env var; the app already binds to `0.0.0.0:$PORT` so no change is needed.
- If you want `gunicorn` instead of Flask's dev server in production, the included `Procfile` does that:
  ```
  web: gunicorn app:app --workers 2 --threads 4 --timeout 60 --bind 0.0.0.0:$PORT
  ```
  Either start command works on Render — `python app.py` is simpler and ships fine for personal use.

---

## 10. API reference

All endpoints return JSON `{ ok: true, … }` on success or `{ ok: false, error: "…" }` on failure with an appropriate HTTP status.

| Method | Path | Body / Query | Purpose |
| ------ | ---- | --- | --- |
| GET    | `/health` | — | Liveness probe. |
| GET    | `/repo-context` | — | Returns `{ context: { username, repo }, fixed_username }`. |
| POST   | `/change-repo` | `{ repo }` | Switch active repo. |
| GET    | `/repo-info` | — | Stars, forks, size, default branch, etc. |
| GET    | `/git-status` | `?branch=&limit=15` | Recent commits. |
| GET    | `/list-files` | `?path=&branch=` | List a directory. |
| GET    | `/read-file` | `?path=&branch=` | Read a file (utf-8 or base64 if binary). |
| POST   | `/upload-file` | `{ path, content, message?, is_base64? }` | Upsert a single file. |
| POST   | `/replace-file` | `{ path, content, message? }` | Replace existing file. |
| POST   | `/delete-file` | `{ path, message? }` | Delete a single file. |
| POST   | `/upload-folder` | `{ path, base_dir?, content (base64), message? }` | Upload one file under a base dir (frontend calls this per-file for progress). |
| POST   | `/delete-many` | `{ paths: [...], recursive?: true, message? }` | Atomically delete many files / folders in one commit. |
| POST   | `/delete-all` | `{ confirm: "DELETE ALL", message? }` | Wipe the entire tree on the active branch. |
| GET    | `/branches` | — | List branches. |

---

## 11. Security model

- **Token never leaves the server.** All GitHub API calls happen in `app.py`. The frontend has no token.
- **Path traversal blocked.** `_is_safe_path()` rejects empty, absolute, or `..`-containing paths and any path > 500 chars.
- **Repo name validation.** `_is_safe_name()` allows alphanumerics, `-`, `_`, `.`, max 100 chars.
- **DELETE ALL requires explicit confirmation phrase** (`"DELETE ALL"`) in both the UI and the API body.
- **100 MB request cap** to keep both Flask and the Render proxy happy.
- **CORS is enabled** because the dashboard fetches via `/...` on the same origin. You can tighten this in `app.py` if you front it with a different domain.

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `GITHUB_TOKEN is not configured on the server` | Env var missing | Set `GITHUB_TOKEN` in `.env` (local) or Render env vars. |
| `404 Not Found` from `/change-repo` | Repo name wrong, or token has no access | Check spelling. The token must have `repo` scope. For private repos, ensure the token can see them. |
| Bulk delete returns "No matching files found" | Paths supplied don't exist on the active branch | Refresh the file list and try again. |
| `DELETE ALL` says "Repository is already empty" | Tree has no blobs | Add at least one file first. |
| Render free dyno responds slowly first request | Spin-up | Wait 30–60s. Hit `/health` to warm it. |
| 413 Request Entity Too Large | Upload exceeds 100 MB | Split into smaller batches. |

---

**Built with ❤️ by dev.sakib · pushes always made as `abysss-sakib`.**
