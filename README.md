# GITPUSH

A premium GitHub repository manager built with Flask. Browse, upload, replace, and delete files in a fixed GitHub repository through a polished file-explorer UI.

> **Author:** dev.sakib · **GitHub user:** `abysss-sakib` (hardcoded)

---

## Features

- **File Explorer UI** — click folders to open, click files to read, checkboxes to multi-select.
- **One-click Delete All** — single confirmation popup. README at root is preserved automatically. No `.gitkeep` is ever created.
- **Atomic uploads & deletes** — every batch operation is one Git commit.
- **Folder upload** — preserve full directory structure with one drag.
- **Auto-recovery from 404s** — listing a deleted folder transparently falls back to root.
- **Retries on transient errors** — both client and server retry 5xx / 409 / 422 with exponential backoff.
- **Light & dark theme.**

---

## Deployment on Render

1. Push this folder to a new GitHub repository.
2. In Render, click **New + → Blueprint** and pick the repo. Render reads `render.yaml` automatically.
3. When prompted, set the only required secret:
   - `GITHUB_TOKEN` — a personal access token for `abysss-sakib` with `repo` scope.
4. Click **Apply**. Render builds with `pip install -r requirements.txt` and starts with `python app.py`.

Health check: `GET /health`

### Environment variables

| Var            | Required | Description                                        |
| -------------- | -------- | -------------------------------------------------- |
| `GITHUB_TOKEN` |   Yes    | GitHub PAT with access to the target repository.   |
| `SECRET_KEY`   |   Auto   | Flask session secret (Render generates one).       |
| `PORT`         |   Auto   | Render injects this — the app binds to `0.0.0.0`.  |

---

## Local development

```bash
pip install -r requirements.txt
export GITHUB_TOKEN=ghp_xxx
python app.py
# → http://localhost:5000
```

---

## Hardcoded username

The GitHub username is fixed to `abysss-sakib` inside `app.py`:

```python
FIXED_USERNAME = "abysss-sakib"
```

Change that constant if you fork this for someone else.
