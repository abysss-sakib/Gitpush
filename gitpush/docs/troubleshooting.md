# Troubleshooting Guide — GITPUSH

> Solutions for the most common errors and issues.

---

## Token Errors

### "GITHUB_TOKEN is not configured on the server"

**Cause:** The server started without a `GITHUB_TOKEN` environment variable.

**Fix:**
```bash
# Check if the variable is set
echo $GITHUB_TOKEN        # macOS/Linux
echo %GITHUB_TOKEN%       # Windows CMD

# If empty, check your .env file
cat .env | grep GITHUB_TOKEN
```

Make sure:
1. Your `.env` file exists in the same folder as `app.py`
2. It contains `GITHUB_TOKEN=ghp_...` (no spaces around `=`)
3. You restarted the server after editing `.env`

---

### "GitHub token is invalid or expired"

**Cause:** The token was revoked, expired, or has wrong permissions.

**Fix:**
1. Go to **https://github.com/settings/tokens**
2. Check if the token is listed — if expired, delete it
3. Create a new token with **`repo`** scope checked
4. Update `GITHUB_TOKEN` in your `.env` file
5. Restart the server

---

### "Token rejected by GitHub (rate limited or insufficient scope)"

**Cause:** The token exists but doesn't have `repo` scope, or you hit the API rate limit.

**Fix for scope issue:**
- Go to **https://github.com/settings/tokens**
- Edit your token → check ✅ **`repo`** → save

**Fix for rate limit:**
- Authenticated tokens get **5,000 requests/hour**
- Each file upload uses 2–4 API calls
- Wait until the next hour, or use a token tied to a different account

---

## Upload Errors

### Upload fails immediately with "No repository selected"

**Cause:** The server lost its context (common on Render after a dyno restart).

**Fix:**
1. Click **Change Repo** in the UI
2. Enter your repo name again
3. Click **Connect**

To prevent this: The app automatically restores context from `localStorage` on page load. This should self-heal, but if it doesn't, reconnecting once fixes it.

---

### Large folder upload stops partway through

**Cause (old version):** Files were uploaded one-by-one and stopped on first error.
**Status (v3 — this version):** ✅ Fixed. Uploads now run 3 at a time and skip failed files instead of stopping.

**If you still see failures:**
- Check the log panel — each file shows ✓ or ✕
- Files marked ✕ usually failed due to GitHub API rate limiting
- Wait 1–2 minutes and re-upload just the failed files
- Or run locally — no rate limiting on your laptop

---

### "File is too large for GitHub's REST API (> 100 MB)"

**Cause:** GitHub's REST API has a hard 100 MB per-file limit.

**Fix:**
- Files > 100 MB require **Git LFS** (Large File Storage)
- Set up Git LFS: `git lfs install` then `git lfs track "*.psd"` etc.
- GITPUSH does not support Git LFS — use the regular Git CLI for those files

---

### Upload shows 500 error on Render free plan

**Cause:** 512 MB RAM limit — base64 encoding inflates file size by 33%, so a 70 MB file needs ~95 MB just for encoding, plus Flask overhead.

**Fix:**
- Switch to Render Starter plan ($7/mo) for more headroom
- Or run the app locally for large uploads
- The streaming upload path (used for files > 2 MB) is already memory-optimized

---

### "Upload timed out after 15 minutes"

**Cause:** The file is extremely large, or the network connection is very slow.

**Fix:**
- The 15-minute timeout is already set in the XHR client
- The `Procfile` sets `--timeout 300` (5 minutes) on gunicorn
- If you need more time, edit `Procfile`: change `300` to `600`
- On Render, very slow uploads may hit platform-level proxy timeouts (not configurable on free plan)

---

## Download ZIP Errors

### "JSZip library not loaded"

**Cause:** The JSZip CDN script failed to load (no internet, CDN down, or browser extension blocked it).

**Fix:**
```html
<!-- The app loads JSZip from cdnjs. Check that this URL is reachable: -->
https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
```

Quick test: paste that URL in a new browser tab — it should show minified JS code.

If your environment blocks CDNs, download JSZip locally:
1. Download from: **https://github.com/Stuk/jszip/releases**
2. Place `jszip.min.js` in `static/js/`
3. In `templates/index.html`, change the script tag to:
```html
<script src="{{ url_for('static', filename='js/jszip.min.js') }}" defer></script>
```

---

### ZIP download only includes some files

**Cause:** Only **files** are included in ZIP downloads — directories are excluded (you can't download a folder path, only the files inside it). Select the files inside the folder instead.

**Also check:** Some files might have failed to fetch (shown as ✕ in the log panel). This happens if:
- The file path contains special characters
- The file was deleted between selecting and downloading
- GitHub API rate limit was hit during fetching

---

## UI / Display Issues

### "Connect a repository to start" — even after setting up

**Cause:** Username or repo was not persisted. The app stores these in `localStorage`.

**Fix:**
1. Click **Change User** → enter your GitHub username → Save
2. Click **Change Repo** → enter repo name (no username prefix) → Connect
3. The repo pill at the top should turn green

---

### Repo pill shows "no repo" after refreshing the page

**Cause:** `localStorage` was cleared (private browsing mode, or browser settings).

**Fix:** Reconnect via Change User + Change Repo. In private/incognito mode, you will need to do this every session.

---

### Files list is empty but the repo has files

**Cause:** GitHub API returned an empty response for the root path (can happen with empty repos or API timeouts).

**Fix:**
1. Click **Refresh** button
2. Check if the repo actually has files on GitHub.com
3. If it's a brand new empty repo, upload a file first

---

## Performance Issues

### Can it handle 1000+ files?

| File count | File size | Estimated time | Notes |
|---|---|---|---|
| 100 files | < 1 MB each | ~2 min | Fast, inline batch |
| 500 files | < 1 MB each | ~8 min | Streaming, 3 concurrent |
| 1000 files | < 1 MB each | ~15 min | GitHub rate limit may slow down |
| 100 files | 5–50 MB each | ~10 min | Streaming path, memory-safe |

**Suggested improvements for very large repos:**
- **Chunk upload:** Split 1000-file folder into batches of 200 and upload separately
- **Resume system:** Not yet built — if upload stops halfway, re-select the failed files and re-upload
- **Queue system:** For production, consider a job queue (Celery + Redis) to handle uploads in the background

---

## Server Logs

To see detailed server-side logs locally:

```bash
# Set debug logging in .env
FLASK_DEBUG=1

# Or run with verbose gunicorn logs
gunicorn app:app --workers 1 --threads 8 --timeout 300 --bind 0.0.0.0:5000 --log-level debug
```

On Render: go to your service → **Logs** tab in the dashboard.
