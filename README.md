# 🚀 GITPUSH

A premium Flask-based GitHub repository manager designed for smooth and efficient repository control.  
GITPUSH provides a modern file-explorer interface where users can browse, upload, replace, and delete repository files directly from the browser with real-time progress tracking and atomic Git operations.

Built with performance and reliability in mind, the system supports large file uploads, folder uploads with preserved structure, bulk operations, persistent repository context, and automatic retry handling for unstable API responses.

---

## ✨ Features

- 📁 Modern File Explorer UI
- ⬆️ Smart File & Folder Upload System
- ⚡ Atomic Git Commits
- 📊 Real-time Upload Progress
- 🗑️ Bulk Delete Operations
- 🔐 GitHub Token Health Checker
- 🧠 Persistent Repository Context
- 🔁 Automatic Retry System
- 🌙 Dark & Light Theme Support
- 🚀 Optimized for Render Deployment

---

## 🛠️ Tech Stack

- Flask
- Python
- HTML
- CSS
- JavaScript
- GitHub REST API
- Werkzeug

---

## 🚀 Run Locally

```bash
pip install -r requirements.txt
export GITHUB_TOKEN=your_token
python app.py
```

Open:
```bash
http://localhost:5000
```

---

## 🌍 Deploy on Render

### Build Command
```bash
pip install -r requirements.txt
```

### Start Command
```bash
gunicorn app:app
```

### Required Environment Variable
```bash
GITHUB_TOKEN=your_github_pat
```

---

## 📦 Environment Variables

| Variable | Description |
|----------|-------------|
| GITHUB_TOKEN | GitHub Personal Access Token |
| SECRET_KEY | Flask Secret Key |
| PORT | Server Port |
| GITPUSH_DEFAULT_USERNAME | Default GitHub Username |

---

## 👨‍💻 Author

**dev.sakib**

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub.
