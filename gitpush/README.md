# GITPUSH — GitHub Repository Manager

> **by dev.sakib** · Production-ready Flask web app for managing GitHub repositories directly from your browser.
> Upload files, upload entire folders (with concurrent streaming), select & delete in bulk, and download any selection as a ZIP — all through a clean, modern UI.

---

## Project ZIP Structure

```
gitpush.zip
 ├── README.md                  ← You are here
 ├── .env.example               ← Copy to .env, add your token
 ├── app.py                     ← Flask backend (all API routes)
 ├── requirements.txt           ← Python dependencies
 ├── Procfile                   ← Gunicorn config (timeout 300s)
 ├── render.yaml                ← One-click Render deployment
 ├── docs/
 │    ├── setup.md              ← Step-by-step local setup
 │    ├── deployment.md         ← Hosting & deployment guide
 │    ├── troubleshooting.md    ← Error fixes & known issues
 │    └── file-structure.md     ← Codebase map & explanation
 ├── templates/
 │    └── index.html            ← Single-page Jinja2 template
 └── static/
      ├── css/
      │    └── style.css        ← Full responsive UI (dark + light)
      └── js/
           └── app.js           ← All frontend logic (vanilla JS)
```

---

## Features

| Feature | Description |
|---|---|
| **File Explorer** | Browse any folder in your repo with breadcrumb navigation |
| **Upload File** | Upload single or multiple files with a real progress bar |
| **Upload Folder** | Upload entire folder trees — preserves directory structure |
| **Concurrent Uploads** | 3 blobs upload in parallel for large folder support |
| **Select All** | Checkbox select any combination of files |
| **Download ZIP** | Download all selected files as a `.zip` (client-side, no server needed) |
| **Bulk Delete** | Delete multiple files/folders in one atomic commit |
| **Delete All** | Wipe every file in the repo (README preserved) |
| **Replace File** | Edit or replace any file inline |
| **Git Status** | View last 15 commits with links |
| **Repo Info** | Stars, forks, size, language, license |
| **Light / Dark Mode** | Toggle persisted in localStorage |
| **Mobile Responsive** | Works on phone, tablet, and desktop |

---

## Quick Start (3 commands)

```bash
git clone https://github.com/yourname/gitpush.git
cd gitpush
cp .env.example .env          # then add your GITHUB_TOKEN
pip install -r requirements.txt
flask run                     # visit http://localhost:5000
```

See **[docs/setup.md](docs/setup.md)** for the full step-by-step guide.

---

## GitHub Token (Required)

1. Go to → **https://github.com/settings/tokens/new**
2. Name: `gitpush`
3. Select scope: ✅ **`repo`** (full repo access)
4. Click **Generate token** — copy immediately (shown once)
5. Paste into `.env`:

```env
GITHUB_TOKEN=ghp_YourTokenHere
```

> **Security:** Never commit your `.env` file. The `.gitignore` already excludes it.

---

## System Analysis

### Can it handle large folders (1000+ files)?

| Scenario | Result |
|---|---|
| < 50 small files | ✅ Inline batch — single JSON commit, very fast |
| 50–500 files, mixed sizes | ✅ Concurrent streaming — 3 blobs at once, one atomic commit |
| 500–1000 files | ✅ Works, takes a few minutes — GitHub API rate limit is the ceiling |
| 1000+ files | ⚠️ Works locally; on Render free plan may hit 512 MB RAM limit |
| Files > 100 MB each | ❌ GitHub REST API hard limit — use Git LFS for those |

### Missing tools / risks in production

| Risk | Severity | Fix |
|---|---|---|
| GitHub API rate limit (5000 req/hr for authenticated) | Medium | Use PAT with high quota; retry logic is built in |
| Render free plan: 512 MB RAM | High | Upgrade to paid ($7/mo) or run locally |
| Render free plan: 30s idle sleep | High | Use paid plan or a cron-style ping to keep alive |
| No auth layer on the web UI | Medium | Add Flask-Login or Replit Auth before sharing publicly |
| Single worker on Render free | Low | `--workers 1 --threads 8` is already set in Procfile |

---

## Where to Run

| Environment | Best for | Notes |
|---|---|---|
| **Local laptop** | Development + large uploads | Zero limits, instant start |
| **Render free** | Demo / sharing | 512 MB RAM, 30s idle sleep — avoid large uploads |
| **Render paid ($7/mo)** | Production | Persistent disk, more RAM, no sleep |
| **Railway / Fly.io** | Production alternative | Similar paid tiers, no sleep |
| **VPS (DigitalOcean, Hetzner)** | Full control | Best for privacy + large repos |

---

## License

MIT — free to use, modify, and distribute.
Built with ❤️ by **dev.sakib**.
