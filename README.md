# GITPUSH

A premium GitHub repository manager built with Flask. Browse, upload, replace,
and delete files across any GitHub repository through a polished
file-explorer UI.

> **Author:** dev.sakib

---

## What's new in this build

- **The "repo not connected" bug after upload is fixed.** The old build
  stored the active repo in a Python dict that lived inside one gunicorn
  worker — so `Change Repo` saved it on worker A but the upload landed on
  worker B and failed. Every API request now sends the active username +
  repo as headers (`X-Gitpush-Username`, `X-Gitpush-Repo`), so any worker
  can serve any request. The selection is also persisted to disk
  (`.gitpush_ctx.json`) and mirrored to `localStorage` in the browser.
- **Change User button.** The GitHub username is no longer hardcoded — pick
  any user from the navbar. The chosen user is verified against GitHub
  before it is saved.
- **Token health pill.** A pill in the top-right shows whether your
  `GITHUB_TOKEN` is valid, including the authenticated login and the
  remaining API rate limit. Click it to re-check on demand.
- **Friendlier error messages** for `401` (expired token) and rate-limit
  responses.

---

## Features

- **File Explorer UI** — click folders to open, click files to read,
  checkboxes to multi-select.
- **One-click Delete All** — single confirmation popup. README at root is
  preserved automatically. No `.gitkeep` is ever created.
- **Atomic uploads & deletes** — every batch operation is one Git commit.
- **Folder upload** — preserve full directory structure with one drag.
- **Auto-recovery from 404s** — listing a deleted folder transparently
  falls back to root.
- **Retries on transient errors** — both client and server retry 5xx /
  409 / 422 with exponential backoff.
- **Light & dark theme.**

---

## Local development

```bash
pip install -r requirements.txt
export GITHUB_TOKEN=ghp_xxx
python app.py
# → http://localhost:5000
```

---

## Deployment on Render

1. Push this folder to a new GitHub repository.
2. In Render, click **New + → Blueprint** and pick the repo. Render reads
   `render.yaml` automatically.
3. When prompted, set the only required secret:
   - `GITHUB_TOKEN` — a personal access token with `repo` scope.
4. Click **Apply**. Render builds with `pip install -r requirements.txt`
   and starts with `python app.py`.

Health check: `GET /health`

### Environment variables

| Var                         | Required | Description                                                                |
| --------------------------- | -------- | -------------------------------------------------------------------------- |
| `GITHUB_TOKEN`              |   Yes    | GitHub PAT with `repo` scope. Without this every API call returns `401`.   |
| `GITPUSH_DEFAULT_USERNAME`  |   No     | Default user shown on first load. Defaults to `abysss-sakib`.              |
| `GITPUSH_CONTEXT_PATH`      |   No     | Path to the persisted context JSON. Defaults to `./.gitpush_ctx.json`.     |
| `SECRET_KEY`                |   Auto   | Flask session secret (Render generates one).                               |
| `PORT`                      |   Auto   | Render injects this — the app binds to `0.0.0.0`.                          |

---

## Token troubleshooting

If the **Token** pill in the top-right shows red, the token is the
problem — not your repo. Common causes:

- `GITHUB_TOKEN` is empty in your hosting platform.
- The token expired (classic PATs expire; fine-grained tokens have a
  fixed expiry date).
- The token doesn't have `repo` scope.
- The token belongs to a user that has no access to the chosen
  repository (private fork, missing collaborator invite, etc.).

Click the pill to re-check after rotating the token.

---

## API quick reference

| Endpoint                   | Method | Purpose                                  |
| -------------------------- | ------ | ---------------------------------------- |
| `/health`                  | GET    | Health probe                             |
| `/token-check`             | GET    | Verify the configured GitHub token       |
| `/repo-context`            | GET    | Return persisted username + repo         |
| `/change-username`         | POST   | Set the active GitHub user (verified)    |
| `/change-repo`             | POST   | Set the active repository                |
| `/repo-info`               | GET    | Repository metadata                      |
| `/git-status`              | GET    | Recent commits                           |
| `/list-files`              | GET    | List files in a path                     |
| `/list-tree`               | GET    | Full recursive tree                      |
| `/read-file`               | GET    | Read a single file                       |
| `/upload-file`             | POST   | Create or update a single file           |
| `/upload-folder-atomic`    | POST   | Push many files in one commit            |
| `/replace-file`            | POST   | Overwrite an existing file               |
| `/delete-file`             | POST   | Delete a single file                     |
| `/delete-many`             | POST   | Delete many files in one commit          |
| `/delete-all`              | POST   | Wipe everything (preserves root README)  |
| `/branches`                | GET    | List branches                            |

All write endpoints accept the active context via headers
`X-Gitpush-Username` / `X-Gitpush-Repo`, body keys `_username` / `_repo`,
or fall back to the persisted `.gitpush_ctx.json` on disk.
