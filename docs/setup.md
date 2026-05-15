# Setup Guide — GITPUSH

> Full step-by-step instructions for running GITPUSH on your local machine.

---

## Requirements

| Tool | Minimum Version | Check command |
|---|---|---|
| Python | 3.10+ | `python --version` |
| pip | 22+ | `pip --version` |
| Git | Any | `git --version` |
| Internet | — | Needed for GitHub API calls |

> **No Node.js required.** The frontend is pure vanilla JS with no build step.

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/yourname/gitpush.git
cd gitpush
```

If you received this as a ZIP file:

```bash
unzip gitpush.zip
cd gitpush
```

---

## Step 2 — Create a Virtual Environment (Recommended)

```bash
# Create
python -m venv venv

# Activate — Windows
venv\Scripts\activate

# Activate — macOS / Linux
source venv/bin/activate
```

You will see `(venv)` in your terminal prompt when it is active.

---

## Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

This installs:

| Package | Purpose |
|---|---|
| `flask` | Web framework (routes, templates, static files) |
| `PyGithub` | GitHub REST API client |
| `flask-cors` | Cross-origin headers |
| `gunicorn` | Production WSGI server |
| `python-dotenv` | Loads `.env` file into environment |

---

## Step 4 — Create Your `.env` File

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in:

```env
# REQUIRED — your GitHub Personal Access Token
GITHUB_TOKEN=ghp_YourTokenHere

# OPTIONAL — your GitHub username (pre-fills the UI)
GITPUSH_DEFAULT_USERNAME=your_github_username

# OPTIONAL — Flask session secret (any random string)
SECRET_KEY=any-random-string-here

# OPTIONAL — leave 0 in production
FLASK_DEBUG=0
```

### How to create a GitHub Token

1. Open: **https://github.com/settings/tokens/new**
2. Name it: `gitpush`
3. Expiration: choose 90 days or "No expiration"
4. Scopes: check ✅ **`repo`** (this gives read/write to all your repos)
5. Scroll down → click **Generate token**
6. Copy the token immediately — GitHub will NOT show it again

> **Security warning:** Treat your token like a password.
> Never commit `.env` to GitHub. The `.gitignore` already excludes it.

---

## Step 5 — Run the App

### Option A — Flask development server (quickest)

```bash
flask run
```

Visit: **http://localhost:5000**

### Option B — Gunicorn (production-like, better for large uploads)

```bash
gunicorn app:app --workers 1 --threads 8 --timeout 300 --bind 0.0.0.0:5000
```

Visit: **http://localhost:5000**

> Use Gunicorn locally if you plan to upload large folders — the development server can time out on long requests.

---

## Step 6 — First Use

1. Open **http://localhost:5000**
2. Click **Change User** → enter your GitHub username
3. Click **Change Repo** → enter a repository name (without the username prefix)
4. The repo pill in the top bar turns green with a pulsing dot — you are connected
5. Click **Files** to browse, or **Upload Folder** to push a folder

---

## Updating the Default Username

Edit `.env`:

```env
GITPUSH_DEFAULT_USERNAME=your_github_username
```

Then restart the server. This is just a pre-fill — you can always change it in the UI.

---

## Running Without a `.env` File

You can also export environment variables directly:

```bash
# macOS / Linux
export GITHUB_TOKEN=ghp_YourTokenHere
flask run

# Windows CMD
set GITHUB_TOKEN=ghp_YourTokenHere
flask run

# Windows PowerShell
$env:GITHUB_TOKEN = "ghp_YourTokenHere"
flask run
```

---

## Common Setup Errors

| Error | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: flask` | Dependencies not installed | Run `pip install -r requirements.txt` |
| `Address already in use` | Port 5000 is busy | Use `flask run --port 5001` |
| `GITHUB_TOKEN is not configured` | `.env` not created or token missing | Check Step 4 above |
| `GitHub user 'x' not found` | Typo in username | Re-enter via Change User |
| `No repository selected` | Context lost (server restart) | Click Change Repo again |
