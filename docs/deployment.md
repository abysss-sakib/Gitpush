# Deployment Guide — GITPUSH

> How to host GITPUSH on the internet so others can access it.

---

## Recommendation Summary

| Platform | Cost | Large Uploads | Sleep | Verdict |
|---|---|---|---|---|
| **Local laptop** | Free | ✅ Best | None | Best for personal use |
| **Render Free** | Free | ⚠️ Risky | 30s idle | Good for demos only |
| **Render Starter ($7/mo)** | $7/mo | ✅ Good | None | Best hosted option |
| **Railway** | ~$5/mo | ✅ Good | None | Good alternative |
| **Fly.io** | Free tier / paid | ✅ Good | Configurable | Good alternative |
| **VPS (DigitalOcean / Hetzner)** | $4–6/mo | ✅ Best | None | Full control |

---

## Option 1 — Render (Easiest, One-Click)

`render.yaml` is already included in the project for instant deployment.

### Steps

1. Create an account at **https://render.com**
2. Click **New → Web Service**
3. Connect your GitHub account and select this repo
4. Render auto-detects `render.yaml` — click **Apply**
5. Go to **Environment** tab → add:
   - Key: `GITHUB_TOKEN` → Value: `ghp_YourTokenHere`
6. Click **Manual Deploy → Deploy latest commit**
7. Your app will be live at `https://gitpush.onrender.com` (or similar)

### Free Plan Limitations

```
RAM:          512 MB
CPU:          Shared
Idle sleep:   After 30 seconds of inactivity (first request takes ~30s to wake)
Upload limit: ~80 MB per file safely (512 MB RAM — base64 inflation is 33%)
Large folders: Risk of OOM (Out of Memory) with 100+ large files
```

### Paid Plan ($7/mo Starter)

```
RAM:          512 MB dedicated (no sharing)
No idle sleep
Persistent disk available
Recommended for: production use + large folder uploads
```

### Fix the `startCommand` for Render

The default `render.yaml` uses `python app.py`. For better performance, change the start command in Render dashboard to:

```
gunicorn app:app --workers 1 --threads 8 --timeout 300 --bind 0.0.0.0:$PORT
```

---

## Option 2 — Railway

1. Sign up at **https://railway.app**
2. Click **New Project → Deploy from GitHub repo**
3. Select your repo
4. Go to **Variables** tab → add `GITHUB_TOKEN`
5. Railway auto-detects Python and runs `gunicorn` from the `Procfile`
6. Your app is live — Railway gives a free `*.railway.app` domain

```
Free tier:    $5 credit/month (roughly 500 hours)
No idle sleep on paid plan
Persistent volumes available
```

---

## Option 3 — Fly.io

```bash
# Install flyctl
brew install flyctl         # macOS
# or: https://fly.io/docs/getting-started/installing-flyctl/

# Authenticate
fly auth login

# Launch (from inside the gitpush/ folder)
fly launch

# Set secret
fly secrets set GITHUB_TOKEN=ghp_YourTokenHere

# Deploy
fly deploy
```

Fly gives a free `*.fly.dev` domain. Free tier includes 3 shared VMs.

---

## Option 4 — VPS (DigitalOcean / Hetzner / Linode)

Best option for large file handling and privacy.

### Setup on Ubuntu 22.04

```bash
# 1. SSH into your VPS
ssh root@your-server-ip

# 2. Install Python
apt update && apt install python3-pip python3-venv nginx -y

# 3. Clone project
git clone https://github.com/yourname/gitpush.git /opt/gitpush
cd /opt/gitpush

# 4. Create venv and install
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 5. Create .env
cp .env.example .env
nano .env   # paste your GITHUB_TOKEN

# 6. Create systemd service
cat > /etc/systemd/system/gitpush.service << 'EOF'
[Unit]
Description=GITPUSH Flask App
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/gitpush
ExecStart=/opt/gitpush/venv/bin/gunicorn app:app --workers 1 --threads 8 --timeout 300 --bind 127.0.0.1:5000
Restart=always
EnvironmentFile=/opt/gitpush/.env

[Install]
WantedBy=multi-user.target
EOF

# 7. Enable and start
systemctl daemon-reload
systemctl enable gitpush
systemctl start gitpush

# 8. Configure Nginx as reverse proxy
cat > /etc/nginx/sites-available/gitpush << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

ln -s /etc/nginx/sites-available/gitpush /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

### Add HTTPS (Free with Let's Encrypt)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | **Yes** | Personal Access Token with `repo` scope |
| `GITPUSH_DEFAULT_USERNAME` | No | Pre-fills the GitHub username in the UI |
| `SECRET_KEY` | No | Flask session secret (auto-generated on Render) |
| `FLASK_DEBUG` | No | Set to `1` only in local development |
| `GITPUSH_CONTEXT_PATH` | No | Path to the context JSON file (default: next to app.py) |
| `PORT` | No | Port to bind (Render/Railway set this automatically) |

---

## Post-Deployment Checklist

- [ ] `GITHUB_TOKEN` is set in environment variables
- [ ] App loads at your domain without errors
- [ ] Click **Change User** → enter username → click **Save**
- [ ] Click **Change Repo** → enter repo name → connected
- [ ] Upload a small test file — verify it appears on GitHub
- [ ] Test folder upload with a small folder (5–10 files)
- [ ] Test **Save ZIP** on 2–3 selected files
