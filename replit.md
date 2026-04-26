# GITPUSH — by dev.sakib

GitHub Repository Manager web app. Pushes are always made as **`abysss-sakib`** (hardcoded).

## Stack
- **Backend**: Python 3.11 + Flask + PyGithub + flask-cors + python-dotenv
- **Frontend**: Vanilla HTML / CSS / JS (glassmorphism, dark+light, animations)
- **Auth**: GitHub PAT via `GITHUB_TOKEN` env var (server-only)
- **Run**: `python app.py` (reads `PORT`, defaults to 5000)
- **Deploy**: Render-ready (`render.yaml`, `Procfile`)

## Key files
- `app.py` — Flask backend, `FIXED_USERNAME = "abysss-sakib"`, atomic Git Data API for bulk delete
- `templates/index.html` — Dashboard markup; only repo name input
- `static/css/style.css` — Exact theme palette, file toolbar + checkbox column
- `static/js/app.js` — Front-end controller; multi-file upload, folder upload, bulk + DELETE ALL
- `requirements.txt`, `render.yaml`, `Procfile`, `.env.example`, `README.md`

## Endpoints
- `GET  /repo-context` · `POST /change-repo` (body: `{repo}`)
- `GET  /repo-info` · `GET /git-status`
- `GET  /list-files?path=` · `GET /read-file?path=`
- `POST /upload-file` · `POST /replace-file` · `POST /delete-file`
- `POST /upload-folder` (called per-file by frontend for progress)
- `POST /delete-many` (atomic bulk; supports folders recursively)
- `POST /delete-all` (wipes tree to empty tree SHA; requires `confirm: "DELETE ALL"`)
- `GET  /branches` · `GET /health`

## Workflow
- `GITPUSH` → `PORT=5000 python app.py`

## Latest features (v3)
- **Multi-file upload**: Upload File button now selects multiple files at once and goes through the same per-file progress flow as Upload Folder.
- **Atomic bulk delete**: New `/delete-many` uses Git Data API to delete N files/folders in a single commit (no partial-failure states).
- **Recursive folder delete**: Click Delete on any folder row → all nested files removed in one commit.
- **DELETE ALL**: Big red button in the file toolbar wipes the entire repo tree, with `DELETE ALL` confirmation phrase. Uses universal empty tree SHA.
- **File-list checkboxes**: Per-row checkboxes + Select all + sticky toolbar showing N selected and a "Delete Selected" button.
- Comprehensive `README.md` with deploy guide, API reference, and customization notes.

## Notes
- Pre-existing `api-server` and `mockup-sandbox` workspace artifacts are unused scaffold from the project template; GITPUSH is a standalone Flask app at the repo root and runs on its own workflow/port.
