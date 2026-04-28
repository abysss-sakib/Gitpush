/* ============================================================
   GITPUSH · dev.sakib
   Front-end controller — file-explorer edition
   ------------------------------------------------------------
   This build is "stateless": every API call sends the active
   username + repo as request headers, so multi-worker gunicorn
   (or a sleeping free-tier dyno that loses memory) cannot drop
   the connection mid-session.  The same values are mirrored to
   localStorage so a fresh tab restores instantly.
   ============================================================ */

const $ = (id) => document.getElementById(id);
const html = document.documentElement;
const DEFAULT_USERNAME = window.GITPUSH_USERNAME || "abysss-sakib";
const ACTIVE_REPO_BOOT  = window.GITPUSH_ACTIVE_REPO || "";

const STORE = {
  user: "gitpush_username",
  repo: "gitpush_repo",
  theme: "gitpush_theme",
};

function readStored() {
  try {
    return {
      username: localStorage.getItem(STORE.user) || "",
      repo:     localStorage.getItem(STORE.repo) || "",
    };
  } catch (_) { return { username: "", repo: "" }; }
}
function writeStored(patch) {
  try {
    if (patch.username !== undefined) localStorage.setItem(STORE.user, patch.username || "");
    if (patch.repo     !== undefined) localStorage.setItem(STORE.repo, patch.repo || "");
  } catch (_) {}
}

const stored = readStored();

const state = {
  username: stored.username || DEFAULT_USERNAME,
  repo:     stored.repo     || ACTIVE_REPO_BOOT || null,
  info: null,
  branch: null,
  currentPath: "",
  lastListing: null,
  selected: new Set(),
  inflight: null,
  tokenOk: null,
};

/* ---------- Theme ---------- */
function applyTheme(theme) {
  html.setAttribute("data-theme", theme);
  try { localStorage.setItem(STORE.theme, theme); } catch (_) {}
}
applyTheme((() => { try { return localStorage.getItem(STORE.theme); } catch (_) { return null; } })() || "dark");
$("themeToggle").addEventListener("click", () => {
  applyTheme(html.getAttribute("data-theme") === "dark" ? "light" : "dark");
});

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, type = "") {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast " + type; }, 3000);
}

/* ---------- Loader ---------- */
let loaderCount = 0;
function showLoader(text = "Working…") {
  loaderCount++;
  $("loaderText").textContent = text;
  $("loader").classList.add("show");
}
function hideLoader() {
  loaderCount = Math.max(0, loaderCount - 1);
  if (loaderCount === 0) $("loader").classList.remove("show");
}

/* ---------- API (with retry on transient 404/5xx) ---------- */
async function api(path, opts = {}, { retries = 2, signal } = {}) {
  // Always send the active username + repo so the server is stateless.
  const headers = {
    "Content-Type": "application/json",
    "X-Gitpush-Username": state.username || "",
    "X-Gitpush-Repo":     state.repo     || "",
    ...(opts.headers || {}),
  };
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(path, { ...opts, headers, signal });
      // Try to parse JSON, but if the server returned HTML / empty / truncated
      // response (worker crash, proxy timeout, etc.), fall back to text so we
      // surface the real diagnostic instead of "Request failed (500)".
      let data = {};
      let rawText = "";
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      try {
        if (ctype.includes("application/json")) {
          data = await res.json();
        } else {
          rawText = await res.text();
          try { data = JSON.parse(rawText); } catch (_) { data = {}; }
        }
      } catch (_) {
        try { rawText = rawText || (await res.text()); } catch (_) {}
      }
      if (res.ok && data.ok !== false) return data;
      let msg = data.error;
      if (!msg) {
        const snippet = (rawText || "").replace(/\s+/g, " ").trim().slice(0, 220);
        msg = snippet
          ? `Server error ${res.status}: ${snippet}`
          : `Request failed (${res.status}) — server returned no body`;
      }
      const err = new Error(msg);
      err.status = res.status;
      err.code   = data.code;
      if (attempt < retries && (res.status >= 500 || res.status === 0)) {
        await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
        lastErr = err;
        continue;
      }
      throw err;
    } catch (e) {
      if (e.name === "AbortError") throw e;
      if (attempt < retries && (!e.status || e.status >= 500)) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error("Request failed");
}

/* ---------- Modal (generic) ---------- */
const modal = $("modal");
function openModal({ title, bodyHtml, footer }) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = bodyHtml;
  $("modalFooter").innerHTML = "";
  (footer || []).forEach(btn => {
    const b = document.createElement("button");
    b.textContent = btn.label;
    if (btn.className) b.className = btn.className;
    b.onclick = () => btn.onClick?.(closeModal);
    $("modalFooter").appendChild(b);
  });
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
$("modalClose").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(); closeConfirm(false); }
});

/* ---------- Confirm dialog ---------- */
const cdlg = $("confirmDialog");
let _confirmResolver = null;
function openConfirm({ title, message, okLabel = "Confirm", cancelLabel = "Cancel", danger = true, icon = "!" }) {
  $("confirmTitle").textContent = title;
  $("confirmMessage").innerHTML = message || "";
  $("confirmIcon").textContent = icon;
  $("confirmIcon").className = "confirm-icon " + (danger ? "danger" : "");
  const ok = $("confirmOk");
  const cancel = $("confirmCancel");
  ok.textContent = okLabel;
  cancel.textContent = cancelLabel;
  ok.className = danger ? "danger" : "primary";
  cdlg.classList.add("open");
  cdlg.setAttribute("aria-hidden", "false");
  return new Promise(resolve => { _confirmResolver = resolve; });
}
function closeConfirm(value) {
  cdlg.classList.remove("open");
  cdlg.setAttribute("aria-hidden", "true");
  if (_confirmResolver) { _confirmResolver(value); _confirmResolver = null; }
}
$("confirmOk").addEventListener("click", () => closeConfirm(true));
$("confirmCancel").addEventListener("click", () => closeConfirm(false));
cdlg.addEventListener("click", (e) => { if (e.target === cdlg) closeConfirm(false); });

/* ---------- Panel ---------- */
function setPanel(title, bodyHtml) {
  $("panelTitle").textContent = title;
  $("panelBody").innerHTML = bodyHtml;
}
$("clearOutput").addEventListener("click", () => {
  if (state.repo) actionListFiles("");
  else setPanel("File Explorer", `<div class="empty-state"><p>Connect a repository to start.</p></div>`);
});

/* ---------- Repo pill / hero ---------- */
function refreshRepoPill() {
  const pill = $("repoPill");
  const text = $("repoPillText");
  const user = state.username || "no user";
  if (state.repo) {
    pill.classList.add("active");
    text.textContent = `${user} / ${state.repo}`;
  } else {
    pill.classList.remove("active");
    text.textContent = `${user} / no repo`;
  }
}

function setTokenStatus(kind, label, title) {
  const el = $("tokenStatus");
  if (!el) return;
  el.classList.remove("token-ok", "token-bad", "token-checking");
  el.classList.add(`token-${kind}`);
  el.title = title || "";
  el.querySelector(".token-label").textContent = label;
}

function renderHero(info) {
  if (!info) {
    $("repoTitle").textContent = state.repo
      ? `${state.username} / ${state.repo}`
      : "Welcome to GITPUSH";
    $("branchTag").hidden = true;
    ["statStars", "statForks", "statSize", "statUpdated"].forEach(id => $(id).textContent = "—");
    return;
  }
  $("repoTitle").textContent = info.full_name;
  if (info.description) {
    $("repoDescription").innerHTML = escapeHtml(info.description);
  }
  $("branchTag").hidden = false;
  $("branchTag").textContent = info.default_branch;
  $("statStars").textContent   = formatNumber(info.stars);
  $("statForks").textContent   = formatNumber(info.forks);
  $("statSize").textContent    = formatSize(info.size_kb);
  $("statUpdated").textContent = relTime(info.pushed_at || info.updated_at);
}

function formatNumber(n) {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
function formatSize(kb) {
  if (kb == null) return "—";
  if (kb < 1024) return kb + " KB";
  if (kb < 1024 * 1024) return (kb / 1024).toFixed(1) + " MB";
  return (kb / (1024 * 1024)).toFixed(2) + " GB";
}
function formatBytes(b) {
  if (b == null) return "—";
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MB";
  return (b / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}
function relTime(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Math.max(1, Math.floor((Date.now() - t) / 1000));
  const units = [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]];
  for (const [u, s] of units) if (diff >= s) return Math.floor(diff / s) + u + " ago";
  return diff + "s ago";
}

/* ---------- Token check (runs at boot, also exposed via UI) ---------- */
async function actionTokenCheck({ silent = false } = {}) {
  setTokenStatus("checking", "Token: …", "Checking GitHub token…");
  try {
    const data = await api("/token-check", {}, { retries: 1 });
    state.tokenOk = true;
    const rl = data.rate_limit || {};
    const label = `Token: ${data.login}`;
    const title = `Token OK · authenticated as ${data.login}`
                + (rl.limit ? ` · ${rl.remaining}/${rl.limit} API calls remaining` : "");
    setTokenStatus("ok", label, title);
    if (!silent) toast(`Token valid (${data.login})`, "success");
    return data;
  } catch (e) {
    state.tokenOk = false;
    const label = e.code === "missing_token" ? "Token: missing" : "Token: invalid";
    setTokenStatus("bad", label, e.message);
    if (!silent) toast(e.message, "error");
    return null;
  }
}

/* ---------- Initial repo context ---------- */
async function loadInitialContext() {
  // First reflect whatever we already know from localStorage.
  refreshRepoPill();
  renderHero(null);

  // Verify token in parallel with restoring repo.
  actionTokenCheck({ silent: true });

  // Pull persisted server-side context, preferring it if the client has none.
  try {
    const data = await api("/repo-context", {}, { retries: 1 });
    const ctx = data.context || {};
    if (!stored.username && ctx.username) {
      state.username = ctx.username;
      writeStored({ username: state.username });
    }
    if (!state.repo && ctx.repo) {
      state.repo = ctx.repo;
      writeStored({ repo: state.repo });
    }
    refreshRepoPill();
  } catch (_) { /* not fatal */ }

  if (state.repo) {
    refreshInfo({ silent: true }).catch(() => {});
    actionListFiles("");
  }
}

function ensureRepo() {
  if (!state.repo) {
    toast("Pick a repository first via Change Repo", "error");
    actionChangeRepo();
    return false;
  }
  return true;
}

/* ---------- Repo actions ---------- */
async function refreshInfo({ silent = false } = {}) {
  try {
    if (!silent) showLoader("Loading repo info…");
    const data = await api("/repo-info");
    state.info = data.info;
    state.branch = data.info.default_branch;
    renderHero(data.info);
    if (!silent) toast("Repo info refreshed", "success");
    return data.info;
  } catch (e) {
    if (!silent) toast(e.message, "error");
    throw e;
  } finally { if (!silent) hideLoader(); }
}

async function actionChangeRepo() {
  openModal({
    title: "Change Repository",
    bodyHtml: `
      <p style="margin:0 0 14px;color:var(--text-dim);font-size:13px">
        Connected as <span class="user-tag">${escapeHtml(state.username)}</span>.
        Just enter the repository name — the username comes from <b>Change User</b>.
      </p>
      <div class="form-row">
        <label for="inRepo">Repository Name</label>
        <div class="prefix-input">
          <span class="prefix">${escapeHtml(state.username)}/</span>
          <input id="inRepo" placeholder="my-awesome-project" value="${escapeAttr(state.repo || '')}" autocomplete="off" />
        </div>
        <span class="hint">Token must have access to this repository.</span>
      </div>
    `,
    footer: [
      { label: "Cancel", onClick: (close) => close() },
      { label: "Connect", className: "primary", onClick: async (close) => {
          const repo = $("inRepo").value.trim();
          if (!repo) return toast("Repository name is required", "error");
          try {
            showLoader("Connecting…");
            const data = await api("/change-repo", {
              method: "POST",
              body: JSON.stringify({ repo, username: state.username }),
            });
            state.repo = repo;
            state.currentPath = "";
            state.selected.clear();
            writeStored({ repo: state.repo });
            refreshRepoPill();
            close();
            toast(data.message || "Connected", "success");
            refreshInfo({ silent: true }).catch(() => {});
            await actionListFiles("");
          } catch (e) { toast(e.message, "error"); }
          finally { hideLoader(); }
      }},
    ],
  });
  setTimeout(() => $("inRepo").focus(), 50);
  $("inRepo").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("modalFooter").querySelectorAll("button")[1]?.click();
  });
}

async function actionChangeUsername() {
  openModal({
    title: "Change GitHub User",
    bodyHtml: `
      <p style="margin:0 0 14px;color:var(--text-dim);font-size:13px">
        Switch the GitHub user this app pushes as. The active token must
        have access to the new user's repositories.
      </p>
      <div class="form-row">
        <label for="inUser">GitHub Username</label>
        <input id="inUser" placeholder="octocat" value="${escapeAttr(state.username || '')}" autocomplete="off" />
        <span class="hint">Switching the user clears the active repo selection.</span>
      </div>
    `,
    footer: [
      { label: "Cancel", onClick: (close) => close() },
      { label: "Save", className: "primary", onClick: async (close) => {
          const username = $("inUser").value.trim();
          if (!username) return toast("Username is required", "error");
          try {
            showLoader("Updating user…");
            const data = await api("/change-username", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
            state.username = data.username;
            state.repo = null;
            state.info = null;
            state.currentPath = "";
            writeStored({ username: state.username, repo: "" });
            refreshRepoPill();
            renderHero(null);
            $("repoDescription").innerHTML = `Connected as <span class="user-tag">${escapeHtml(state.username)}</span>. Click <b>Change Repo</b> to pick a repository.`;
            setPanel("File Explorer", `<div class="empty-state"><p>Connect a repository to start managing files.</p></div>`);
            close();
            toast(data.message || "Username updated", "success");
          } catch (e) { toast(e.message, "error"); }
          finally { hideLoader(); }
      }},
    ],
  });
  setTimeout(() => $("inUser").focus(), 50);
  $("inUser").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("modalFooter").querySelectorAll("button")[1]?.click();
  });
}

/* ---------- File explorer ---------- */
async function actionListFiles(path = "") {
  if (!ensureRepo()) return;
  if (state.inflight) { try { state.inflight.abort(); } catch (_) {} }
  const ctrl = new AbortController();
  state.inflight = ctrl;

  renderSkeleton(path);

  try {
    const data = await api(
      `/list-files?path=${encodeURIComponent(path)}`,
      {}, { retries: 2, signal: ctrl.signal }
    );
    state.currentPath = data.path || "";
    state.lastListing = data;
    state.selected.clear();
    renderFileList(data);
  } catch (e) {
    if (e.name === "AbortError") return;
    toast(e.message, "error");
    setPanel("Files", `<div class="empty-state"><p>${escapeHtml(e.message)}</p>
      <button class="ghost-btn" id="retryList">Retry</button></div>`);
    $("retryList")?.addEventListener("click", () => actionListFiles(path));
  } finally {
    if (state.inflight === ctrl) state.inflight = null;
  }
}

function renderSkeleton(path) {
  const segs = path ? path.split("/") : [];
  let crumbs = `<span class="crumb" data-path="">root</span>`;
  let acc = "";
  segs.forEach(seg => {
    acc = acc ? `${acc}/${seg}` : seg;
    crumbs += `<span class="sep">/</span><span class="crumb" data-path="${escapeAttr(acc)}">${escapeHtml(seg)}</span>`;
  });
  const rows = Array.from({ length: 6 }).map(() => `
    <div class="file-row skel">
      <span class="cb-cell"></span>
      <span class="icon"></span>
      <span class="name"><span class="sk-line"></span></span>
      <span class="size"><span class="sk-line short"></span></span>
      <span class="actions-inline"></span>
    </div>
  `).join("");
  setPanel(`Files · ${path || "root"}`, `
    <div class="path-bar">${crumbs}</div>
    <div class="file-toolbar muted-toolbar">Loading…</div>
    <div class="file-list">${rows}</div>
  `);
  document.querySelectorAll(".path-bar .crumb").forEach(el => {
    el.addEventListener("click", () => actionListFiles(el.dataset.path));
  });
}

function renderFileList(data) {
  const segments = data.path ? data.path.split("/") : [];
  let crumbs = `<span class="crumb" data-path="">root</span>`;
  let acc = "";
  segments.forEach((seg) => {
    acc = acc ? `${acc}/${seg}` : seg;
    crumbs += `<span class="sep">/</span><span class="crumb" data-path="${escapeAttr(acc)}">${escapeHtml(seg)}</span>`;
  });

  const upBtn = data.path
    ? `<button class="ghost-btn" id="upBtn" title="Go up one folder">↑ Up</button>`
    : "";

  const toolbar = `
    <div class="file-toolbar">
      <label class="cb-row">
        <input type="checkbox" id="selectAll" />
        <span>Select all</span>
      </label>
      <span class="sel-count" id="selCount">0 selected</span>
      ${upBtn}
      <div class="toolbar-spacer"></div>
      <button class="ghost-btn" id="bulkDeleteBtn" disabled>Delete Selected</button>
      <button class="danger-solid" id="nukeBtn" title="Delete every file in the repository">Delete All</button>
    </div>
  `;

  const rows = data.items.map((it) => `
    <div class="file-row" data-path="${escapeAttr(it.path)}" data-type="${it.type}">
      <span class="cb-cell">
        <input type="checkbox" class="row-cb" data-path="${escapeAttr(it.path)}" data-type="${it.type}" />
      </span>
      <span class="icon ${it.type === 'dir' ? 'dir' : 'file'}">
        ${it.type === "dir"
          ? `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 4H2v16h20V6H12z"/></svg>`
          : `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9z"/></svg>`}
      </span>
      <span class="name" title="${escapeAttr(it.path)}" data-act="${it.type === 'dir' ? 'open' : 'read'}" data-path="${escapeAttr(it.path)}">${escapeHtml(it.name)}</span>
      <span class="size">${it.type === "dir" ? "—" : formatSize(Math.round((it.size||0)/1024))}</span>
      <span class="actions-inline">
        ${it.type === "dir"
          ? `<button data-act="open"   data-path="${escapeAttr(it.path)}" title="Open folder">Open</button>
             <button data-act="del-dir" data-path="${escapeAttr(it.path)}" class="danger-link" title="Delete folder">Delete</button>`
          : `<button data-act="read"    data-path="${escapeAttr(it.path)}" title="Read file">Read</button>
             <button data-act="replace" data-path="${escapeAttr(it.path)}" title="Replace contents">Replace</button>
             <button data-act="delete"  data-path="${escapeAttr(it.path)}" class="danger-link" title="Delete file">Delete</button>`}
      </span>
    </div>
  `).join("");

  const body = data.items.length
    ? `<div class="path-bar">${crumbs}</div>${toolbar}<div class="file-list">${rows}</div>`
    : `<div class="path-bar">${crumbs}</div>${toolbar}
       <div class="empty-state">
         <p>This folder is empty.</p>
         <p class="muted">Use <b>Upload File</b> or <b>Upload Folder</b> to add content.</p>
       </div>`;

  setPanel(`Files · ${data.path || "root"} · ${data.count} item(s)`, body);
  wireFileListInteractions(data);
}

function wireFileListInteractions(data) {
  const panelBody = $("panelBody");

  panelBody.querySelectorAll(".path-bar .crumb").forEach(el => {
    el.addEventListener("click", () => actionListFiles(el.dataset.path));
  });

  $("upBtn")?.addEventListener("click", () => {
    const parts = (state.currentPath || "").split("/").filter(Boolean);
    parts.pop();
    actionListFiles(parts.join("/"));
  });

  panelBody.querySelectorAll(".file-row .name").forEach(el => {
    el.addEventListener("click", () => {
      const act = el.dataset.act;
      const path = el.dataset.path;
      if (act === "open") actionListFiles(path);
      else actionReadFile(path);
    });
  });

  panelBody.querySelectorAll(".file-row .actions-inline button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const path = btn.dataset.path;
      const act  = btn.dataset.act;
      if (act === "open")    actionListFiles(path);
      if (act === "read")    actionReadFile(path);
      if (act === "replace") actionReplaceFile(path);
      if (act === "delete")  actionDeleteSelected([{ path, type: "file" }]);
      if (act === "del-dir") actionDeleteSelected([{ path, type: "dir"  }]);
    });
  });

  const selectAll = $("selectAll");
  const cbs = panelBody.querySelectorAll(".row-cb");
  const updateCount = () => {
    state.selected.clear();
    panelBody.querySelectorAll(".row-cb:checked").forEach(cb => state.selected.add(cb.dataset.path));
    const n = state.selected.size;
    $("selCount").textContent = `${n} selected`;
    const bulk = $("bulkDeleteBtn");
    bulk.disabled = n === 0;
    bulk.textContent = n === 0 ? "Delete Selected" : `Delete Selected (${n})`;
    selectAll.indeterminate = n > 0 && n < cbs.length;
    selectAll.checked = n === cbs.length && cbs.length > 0;
  };
  selectAll?.addEventListener("change", () => {
    cbs.forEach(cb => cb.checked = selectAll.checked);
    updateCount();
  });
  cbs.forEach(cb => cb.addEventListener("change", updateCount));

  $("bulkDeleteBtn")?.addEventListener("click", () => {
    const items = Array.from(panelBody.querySelectorAll(".row-cb:checked"))
      .map(cb => ({ path: cb.dataset.path, type: cb.dataset.type }));
    if (items.length) actionDeleteSelected(items);
  });

  $("nukeBtn")?.addEventListener("click", () => actionDeleteAll());

  updateCount();
}

/* ---------- Read / Replace ---------- */
async function actionReadFile(path) {
  if (!ensureRepo() || !path) return;
  try {
    showLoader("Reading file…");
    const data = await api(`/read-file?path=${encodeURIComponent(path)}`);
    const f = data.file;
    const display = f.is_binary
      ? `[binary file, ${f.size} bytes]\n\nBase64 (truncated):\n${f.content.slice(0, 4000)}${f.content.length > 4000 ? "\n…" : ""}`
      : f.content;
    setPanel(`File · ${f.path}`, `
      <div class="path-bar">
        <span class="crumb" data-path="">root</span>
        ${pathDir(f.path) ? `<span class="sep">/</span><span class="crumb" data-path="${escapeAttr(pathDir(f.path))}">${escapeHtml(pathDir(f.path))}</span>` : ""}
        <span class="sep">·</span>
        <span>${escapeHtml(f.name)}</span>
        <span class="sep">·</span>
        <span>${formatSize(Math.round((f.size||0)/1024))}</span>
        <span class="sep">·</span>
        <span>sha ${f.sha.slice(0,7)}</span>
        ${f.html_url ? `<span class="sep">·</span><a href="${f.html_url}" target="_blank" rel="noopener">View on GitHub</a>` : ""}
      </div>
      <div class="file-toolbar">
        <button class="ghost-btn" id="backToFolder">← Back to folder</button>
        <div class="toolbar-spacer"></div>
        <button class="ghost-btn" id="replaceFromRead">Replace</button>
        <button class="danger-link" id="deleteFromRead">Delete</button>
      </div>
      <pre class="code-viewer">${escapeHtml(display)}</pre>
    `);
    document.querySelectorAll(".path-bar .crumb").forEach(el => {
      el.addEventListener("click", () => actionListFiles(el.dataset.path));
    });
    $("backToFolder").addEventListener("click", () => actionListFiles(pathDir(f.path)));
    $("replaceFromRead").addEventListener("click", () => actionReplaceFile(f.path));
    $("deleteFromRead").addEventListener("click", () => actionDeleteSelected([{ path: f.path, type: "file" }]));
    toast("File loaded", "success");
  } catch (e) { toast(e.message, "error"); }
  finally { hideLoader(); }
}

async function actionReplaceFile(path) {
  if (!ensureRepo() || !path) return;
  let existing = "";
  try {
    showLoader("Loading current file…");
    const data = await api(`/read-file?path=${encodeURIComponent(path)}`);
    existing = data.file.is_binary ? "" : data.file.content;
  } catch (e) { toast(e.message, "error"); return; }
  finally { hideLoader(); }

  openModal({
    title: "Replace File",
    bodyHtml: `
      <div class="form-row">
        <label>File path</label>
        <input id="fPath" value="${escapeAttr(path)}" readonly>
      </div>
      <div class="form-row">
        <label>Commit message</label>
        <input id="fMsg" value="GITPUSH: replace ${escapeAttr(path)}">
      </div>
      <div class="form-row">
        <label>Content</label>
        <textarea id="fContent">${escapeHtml(existing)}</textarea>
        <span class="hint">Or attach a file: <input id="fUpload" type="file" style="margin-top:4px"></span>
      </div>
    `,
    footer: [
      { label: "Cancel", onClick: (close) => close() },
      { label: "Replace", className: "primary", onClick: async (close) => {
          const message = $("fMsg").value.trim() || `GITPUSH: replace ${path}`;
          const content = $("fContent").value;
          try {
            showLoader("Replacing file…");
            const data = await api("/replace-file", {
              method: "POST",
              body: JSON.stringify({ path, content, message }),
            });
            close();
            toast(`${data.message} (${data.commit?.slice(0,7)})`, "success");
            await actionListFiles(state.currentPath || pathDir(path));
          } catch (e) { toast(e.message, "error"); }
          finally { hideLoader(); }
      }},
    ],
  });
  wireSingleFileInput();
}

function wireSingleFileInput() {
  const upload = $("fUpload");
  if (!upload) return;
  upload.addEventListener("change", () => {
    const file = upload.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { $("fContent").value = typeof reader.result === "string" ? reader.result : ""; };
    reader.onerror = () => toast("Could not read file", "error");
    reader.readAsText(file);
  });
}

function pathDir(p) {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i) : "";
}

/* ---------- Multi-file & folder upload ---------- */
function actionUploadFile() {
  if (!ensureRepo()) return;
  const picker = $("filePicker");
  picker.value = "";
  picker.onchange = (e) => handleFilesPicked(e, false);
  picker.click();
}

function actionUploadFolder() {
  if (!ensureRepo()) return;
  const picker = $("folderPicker");
  picker.value = "";
  picker.onchange = (e) => handleFilesPicked(e, true);
  picker.click();
}

function handleFilesPicked(e, isFolder) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  let rootFolder = "";
  let items;
  if (isFolder) {
    const firstRel = files[0].webkitRelativePath || files[0].name;
    rootFolder = firstRel.includes("/") ? firstRel.split("/")[0] : "";
    items = files.map(f => {
      let rel = f.webkitRelativePath || f.name;
      if (rootFolder && rel.startsWith(rootFolder + "/")) {
        rel = rel.slice(rootFolder.length + 1);
      }
      return { file: f, rel };
    })
    .filter(x => x.rel && !x.rel.endsWith("/"))
    .filter(x => !x.rel.split("/").some(seg => seg === ".git"));
  } else {
    items = files.map(f => ({ file: f, rel: f.name }));
  }

  if (!items.length) return toast("No files found", "error");

  const totalBytes = items.reduce((s, x) => s + x.file.size, 0);
  const title = isFolder
    ? `Upload Folder Contents`
    : `Upload ${items.length} File${items.length > 1 ? "s" : ""}`;
  const defaultBase = state.currentPath || "";

  openModal({
    title,
    bodyHtml: `
      <p style="margin:0 0 12px;color:var(--text-dim)">
        <b>${items.length}</b> file${items.length > 1 ? "s" : ""} (${formatBytes(totalBytes)})
        ${rootFolder ? `from folder <span class="user-tag">${escapeHtml(rootFolder)}</span>` : ""}.
        Full folder structure will be preserved.
      </p>
      <div class="form-row">
        <label>Target directory in repo (optional)</label>
        <input id="fBase" placeholder="leave empty for repo root" value="${escapeAttr(defaultBase)}" />
        <span class="hint">
          ${isFolder
            ? `Contents of <b>${escapeHtml(rootFolder)}</b> will be uploaded here (folder itself not created).`
            : "Files will be placed directly inside this path."}
        </span>
      </div>
      <div class="form-row">
        <label>Commit message prefix</label>
        <input id="fBaseMsg" value="GITPUSH: ${isFolder ? `upload folder ${rootFolder}` : "upload files"}" />
      </div>
    `,
    footer: [
      { label: "Cancel", onClick: (close) => close() },
      { label: `Upload ${items.length}`, className: "primary", onClick: (close) => {
          const baseDir = $("fBase").value.trim().replace(/^\/+|\/+$/g, "");
          const msgPrefix = $("fBaseMsg").value.trim() || "GITPUSH: upload";
          close();
          if (!isFolder && items.length === 1) {
            runSingleFileUpload(items[0], baseDir, msgPrefix);
          } else {
            runFolderUpload(items, baseDir, msgPrefix);
          }
      }},
    ],
  });
}

async function runSingleFileUpload(item, baseDir, msgPrefix) {
  // Lighter path for the common case: 1 file → 1 commit via the Contents API
  // (one HTTP call to GitHub instead of four). Less to go wrong on small hosts.
  const total = 1;
  const fullPath = (baseDir ? baseDir.replace(/\/+$/, "") + "/" : "") + item.rel;
  setPanel(`Uploading · ${item.rel}`, `
    <div class="folder-summary">
      ${cell("File", escapeHtml(fullPath))}
      ${cell("Size", formatBytes(item.file.size))}
      ${cell("Status", `<span id="pgStatus">Reading file…</span>`)}
    </div>
    <div class="progress-shell"><div class="progress-fill" id="pgFill" style="width:0%"></div></div>
    <div id="pgLog" style="font-size:12px;color:var(--text-dim);margin-top:10px;padding:0 2px"></div>
  `);

  let content;
  try {
    content = await fileToBase64(item.file);
    if ($("pgFill"))   $("pgFill").style.width = "50%";
    if ($("pgStatus")) $("pgStatus").textContent = "Pushing to GitHub…";
  } catch (e) {
    toast("Could not read file: " + (e.message || ""), "error");
    return;
  }

  const message = `${msgPrefix} ${item.rel}`;
  try {
    const data = await api("/upload-file", {
      method: "POST",
      body: JSON.stringify({
        path: fullPath,
        content,
        message,
        is_base64: true,
        overwrite: true,
      }),
    }, { retries: 1 });
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML = `<span style="color:var(--success)">✓ Done — commit <b>${(data.commit||"").slice(0,7)}</b></span>`;
    toast(`${data.action === "create" ? "Created" : "Updated"} ${fullPath}`, "success");
    refreshInfo({ silent: true }).catch(() => {});
    setTimeout(() => actionListFiles(state.currentPath || pathDir(fullPath)), 600);
  } catch (e) {
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML = `<span style="color:var(--danger)">✕ Failed: ${escapeHtml(e.message)}</span>`;
    toast(e.message, "error");
  }
}

async function runFolderUpload(items, baseDir, msgPrefix) {
  const total = items.length;
  setPanel(`Uploading · ${total} file(s) — preparing…`, `
    <div class="folder-summary">
      ${cell("Total files", total)}
      ${cell("Target", baseDir || "&lt;repo root&gt;")}
      ${cell("Status", `<span id="pgStatus">Reading files…</span>`)}
    </div>
    <div class="progress-shell"><div class="progress-fill" id="pgFill" style="width:0%"></div></div>
    <div id="pgLog" style="font-size:12px;color:var(--text-dim);margin-top:10px;max-height:300px;overflow-y:auto;padding:0 2px"></div>
  `);

  const filePayload = [];
  let readDone = 0;
  for (const it of items) {
    try {
      const content = await fileToBase64(it.file);
      filePayload.push({ path: it.rel, content });
    } catch (_) {
      const log = $("pgLog");
      if (log) log.innerHTML += `<div style="color:var(--danger)">✕ Read failed: ${escapeHtml(it.rel)}</div>`;
    }
    readDone++;
    if ($("pgFill"))   $("pgFill").style.width = `${Math.round((readDone / total) * 50)}%`;
    if ($("pgStatus")) $("pgStatus").textContent = `Reading files… ${readDone}/${total}`;
  }
  if (!filePayload.length) { toast("No files could be read", "error"); return; }

  if ($("pgStatus")) $("pgStatus").textContent = `Pushing ${filePayload.length} files to GitHub…`;
  if ($("pgFill"))   $("pgFill").style.width = "60%";

  const commitMsg = `${msgPrefix} (${filePayload.length} files)`;
  try {
    const data = await api("/upload-folder-atomic", {
      method: "POST",
      body: JSON.stringify({ files: filePayload, base_dir: baseDir, message: commitMsg }),
    }, { retries: 1 });

    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML = `<span style="color:var(--success)">✓ Done — commit <b>${(data.commit||"").slice(0,7)}</b></span>`;
    const log = $("pgLog");
    if (log) {
      log.innerHTML = filePayload.map(f =>
        `<div><span style="color:var(--success)">✓</span> ${escapeHtml(f.path)}</div>`
      ).join("");
    }
    toast(`✓ Uploaded ${data.files_count} file(s) in 1 commit`, "success");
    refreshInfo({ silent: true }).catch(() => {});
    setTimeout(() => actionListFiles(state.currentPath || ""), 600);
  } catch (e) {
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML = `<span style="color:var(--danger)">✕ Failed: ${escapeHtml(e.message)}</span>`;
    toast(e.message, "error");
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const i = dataUrl.indexOf(",");
      resolve(i >= 0 ? dataUrl.slice(i + 1) : "");
    };
    reader.onerror = () => reject(new Error("Could not read " + file.name));
    reader.readAsDataURL(file);
  });
}

/* ---------- Bulk / single delete (atomic, single confirmation) ---------- */
async function actionDeleteSelected(items) {
  if (!ensureRepo()) return;
  if (!items?.length) return;
  const hasDir = items.some(i => i.type === "dir");
  const list = items.slice(0, 8).map(i => `• ${escapeHtml(i.path)}${i.type === 'dir' ? ' /' : ''}`).join("<br>");
  const more = items.length > 8 ? `<br><span class="muted">…and ${items.length - 8} more</span>` : "";

  const ok = await openConfirm({
    title: items.length === 1 ? "Delete this item?" : `Delete ${items.length} items?`,
    message: `${list}${more}${hasDir ? `<br><br><span class="muted">Folders are deleted recursively.</span>` : ""}`,
    okLabel: items.length === 1 ? "Delete" : `Delete ${items.length}`,
    cancelLabel: "Cancel",
    danger: true,
    icon: "🗑",
  });
  if (!ok) return;

  const message = `GITPUSH: delete ${items.length} item(s)`;
  try {
    showLoader("Deleting…");
    const data = await api("/delete-many", {
      method: "POST",
      body: JSON.stringify({ paths: items.map(i => i.path), recursive: true, message }),
    }, { retries: 1 });
    toast(`Deleted ${data.count} file(s) (${data.commit?.slice(0,7)})`, "success");
    setTimeout(() => actionListFiles(state.currentPath || ""), 500);
    refreshInfo({ silent: true }).catch(() => {});
  } catch (e) { toast(e.message, "error"); }
  finally { hideLoader(); }
}

async function actionDeleteAll() {
  if (!ensureRepo()) return;
  const ok = await openConfirm({
    title: "Delete EVERYTHING?",
    message: `This wipes every file in <b>${escapeHtml(state.username)}/${escapeHtml(state.repo)}</b>.<br>
              <span class="muted">A README at the repository root (if any) will be preserved.<br>
              Commit history is kept. This cannot be undone from the UI.</span>`,
    okLabel: "Yes, Delete All",
    cancelLabel: "Cancel",
    danger: true,
    icon: "⚠",
  });
  if (!ok) return;

  try {
    showLoader("Deleting all files…");
    const data = await api("/delete-all", {
      method: "POST",
      body: JSON.stringify({ message: "GITPUSH: full repository cleanup" }),
    }, { retries: 1 });
    if (data.already_clean) {
      toast("Repository is already clean.", "success");
    } else {
      toast(`${data.message}${data.commit ? ' (' + data.commit.slice(0,7) + ')' : ''}`, "success");
    }
    setTimeout(() => actionListFiles(""), 600);
    refreshInfo({ silent: true }).catch(() => {});
  } catch (e) { toast(e.message, "error"); }
  finally { hideLoader(); }
}

/* ---------- Repo info / Git status views ---------- */
async function actionRepoInfo() {
  if (!ensureRepo()) return;
  try {
    showLoader("Fetching repo info…");
    const data = await api("/repo-info");
    state.info = data.info;
    renderHero(data.info);
    const i = data.info;
    setPanel("Repository Info", `
      <div class="info-grid">
        ${cell("Owner", i.owner)}
        ${cell("Name", i.name)}
        ${cell("Default Branch", i.default_branch)}
        ${cell("Visibility", i.private ? "Private" : "Public")}
        ${cell("Language", i.language)}
        ${cell("License", i.license || "—")}
        ${cell("Stars", formatNumber(i.stars))}
        ${cell("Forks", formatNumber(i.forks))}
        ${cell("Watchers", formatNumber(i.watchers))}
        ${cell("Open Issues", formatNumber(i.open_issues))}
        ${cell("Size", formatSize(i.size_kb))}
        ${cell("Created", new Date(i.created_at).toLocaleString())}
        ${cell("Updated", new Date(i.updated_at).toLocaleString())}
        ${cell("Last Push", new Date(i.pushed_at).toLocaleString())}
        ${cell("URL", `<a href="${i.html_url}" target="_blank" rel="noopener">${i.html_url}</a>`)}
      </div>
      <div style="margin-top:14px"><button class="ghost-btn" id="backToFiles">← Back to Files</button></div>
    `);
    $("backToFiles")?.addEventListener("click", () => actionListFiles(state.currentPath || ""));
    toast("Repo info loaded", "success");
  } catch (e) { toast(e.message, "error"); }
  finally { hideLoader(); }
}
function cell(k, v) {
  return `<div class="info-card"><span class="k">${k}</span><span class="v">${v ?? "—"}</span></div>`;
}

async function actionGitStatus() {
  if (!ensureRepo()) return;
  try {
    showLoader("Loading recent commits…");
    const data = await api("/git-status?limit=15");
    const rows = data.commits.map((c) => `
      <div class="commit-item">
        <a class="commit-sha" href="${c.html_url}" target="_blank" rel="noopener">${c.short_sha}</a>
        <div class="commit-msg">${escapeHtml(c.message)}</div>
        <div class="commit-meta">${escapeHtml(c.author)}<br>${c.date ? new Date(c.date).toLocaleString() : ""}</div>
      </div>
    `).join("") || `<div class="empty-state"><p>No commits found.</p></div>`;
    setPanel(`Git Status · ${data.branch}`, `
      <div class="path-bar">
        Branch <b style="color:var(--accent)">${escapeHtml(data.branch)}</b>
        <span class="sep">·</span>
        Showing latest <b>${data.count}</b> commits
      </div>
      <div class="commit-list">${rows}</div>
      <div style="margin-top:14px"><button class="ghost-btn" id="backToFiles2">← Back to Files</button></div>
    `);
    $("backToFiles2")?.addEventListener("click", () => actionListFiles(state.currentPath || ""));
    toast("Git status loaded", "success");
  } catch (e) { toast(e.message, "error"); }
  finally { hideLoader(); }
}

async function actionRefresh() {
  // Re-check the token in case it was rotated server-side.
  actionTokenCheck({ silent: true });
  if (state.repo) {
    refreshInfo({ silent: true }).catch(() => {});
    await actionListFiles(state.currentPath || "");
  } else {
    toast("Nothing to refresh — pick a repo", "error");
  }
}

/* ---------- Wiring ---------- */
document.querySelectorAll(".action-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const act = btn.dataset.action;
    if (act === "list")            actionListFiles(state.currentPath || "");
    if (act === "upload")          actionUploadFile();
    if (act === "upload-folder")   actionUploadFolder();
    if (act === "info")            actionRepoInfo();
    if (act === "status")          actionGitStatus();
    if (act === "change")          actionChangeRepo();
    if (act === "change-user")     actionChangeUsername();
    if (act === "refresh")         actionRefresh();
  });
});

// Token pill click → re-check the token on demand.
$("tokenStatus")?.addEventListener("click", () => actionTokenCheck());

/* ---------- Utils ---------- */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[m]);
}
function escapeAttr(s) { return escapeHtml(s); }

/* ---------- Boot ---------- */
loadInitialContext();
