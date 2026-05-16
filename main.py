#!/usr/bin/env python3
"""
GITPUSH - Local runner
  python main.py              → runs on port 5000
  PORT=8080 python main.py    → custom port
  FLASK_DEBUG=1 python main.py → auto-reload on code changes
"""
import os
from app import app

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    print(f"\n🚀 GITPUSH running at http://localhost:{port}")
    print(f"   Debug/auto-reload: {'ON' if debug else 'OFF'}")
    print(f"   Press Ctrl+C to stop\n")
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
