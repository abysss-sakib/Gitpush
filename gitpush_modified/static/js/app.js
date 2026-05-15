/* ============================================================
   GITPUSH · dev.sakib — Fixed & Enhanced v4
   Changes from v3:
     5. CRITICAL: Folder upload now preserves the root folder name
        in the repo by default (fBase defaults to rootFolder, not "")
     6. Upload modal shows live path preview of first 5 files
     7. Cancel button on long uploads (AbortController)
     8. Inline batch uploads files in chunks of 10 to avoid
        exhausting browser memory on large folders
     9. "Retry failed" button after partial streaming upload
    10. .muted utility class defined; minor stability fixes
   ============================================================ */

const $ = (id) => document.getElementById(id);
const html = document.documentElement;
const DEFAULT_USERNAME = window.GITPUSH_USERNAME || "abysss-sakib";
const ACTIVE_REPO_BOOT  = window.GITPUSH_ACTIVE_REPO || "";

const STORE = {
  user:  "gitpush_username",
  repo:  "gitpush_repo",
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
  username:    stored.username || DEFAULT_USERNAME,
  repo:        stored.repo     || ACTIVE_REPO_BOOT || null,
  info:        null,
  branch:      null,
  currentPath: "",
  lastListing: null,
  selected:    new Set(),
  inflight:    null,
  uploadAbort: null,   // AbortController for cancellable uploads
};

/* ---------- Theme ---------- */
function applyTheme(theme) {
  html.setAttribute("data-theme", theme);
  try { localStorage.setItem(STORE.theme, theme); } catch (_) {}
}
applyTheme((() => {
  try { return localStorage.getItem(STORE.theme); } catch (_) { return null; }
})() || "dark");

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
  toastTimer = setTimeout(() => { el.className = "toast " + type; }, 3500);
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

/* ---------- API (with retry on transient 5xx) ---------- */
async function api(path, opts = {}, { retries = 2, signal } = {}) {
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
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        lastErr = err;
        continue;
      }
      throw err;
    } catch (e) {
      if (e.name === "AbortError") throw e;
      if (attempt < retries && (!e.status || e.status >= 500)) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
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

/* ---------- Initial repo context ---------- */
async function loadInitialContext() {
  refreshRepoPill();
  renderHero(null);

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
    if (state.repo && !ctx.repo) {
      api("/change-repo", {
        method: "POST",
        body: JSON.stringify({ repo: state.repo, username: state.username }),
      }).catch(() => {});
    }
    refreshRepoPill();
  } catch (_) {}

  if (state.repo) {
    refreshInfo({ silent: true }).catch(() => {
      renderHero(null);
      refreshRepoPill();
    });
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
    state.info   = data.info;
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

  // Toolbar with Select All, count, Delete Selected, Download ZIP, Delete All
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
      <button class="download-zip-btn" id="downloadZipBtn" disabled title="Download selected files as ZIP">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 16l-5-5 1.4-1.4 2.6 2.6V4h2v8.2l2.6-2.6L17 11l-5 5zm-7 2h14v2H5z"/></svg>
        Save ZIP
      </button>
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
    panelBody.querySelectorAll(".row-cb:checked").forEach(cb => {
      if (cb.dataset.type === "file") state.selected.add(cb.dataset.path);
    });
    const nFiles = state.selected.size;
    const nAll   = panelBody.querySelectorAll(".row-cb:checked").length;

    const selCount = $("selCount");
    if (selCount) {
      selCount.textContent = `${nAll} selected`;
      selCount.classList.toggle("has-selection", nAll > 0);
    }

    const bulk = $("bulkDeleteBtn");
    if (bulk) {
      bulk.disabled = nAll === 0;
      bulk.textContent = nAll === 0 ? "Delete Selected" : `Delete Selected (${nAll})`;
    }

    const dlBtn = $("downloadZipBtn");
    if (dlBtn) {
      dlBtn.disabled = nFiles === 0;
      dlBtn.innerHTML = nFiles === 0
        ? `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 16l-5-5 1.4-1.4 2.6 2.6V4h2v8.2l2.6-2.6L17 11l-5 5zm-7 2h14v2H5z"/></svg> Save ZIP`
        : `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 16l-5-5 1.4-1.4 2.6 2.6V4h2v8.2l2.6-2.6L17 11l-5 5zm-7 2h14v2H5z"/></svg> Save ZIP (${nFiles})`;
    }

    if (selectAll) {
      selectAll.indeterminate = nAll > 0 && nAll < cbs.length;
      selectAll.checked = nAll === cbs.length && cbs.length > 0;
    }
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

  $("downloadZipBtn")?.addEventListener("click", () => {
    const paths = Array.from(state.selected);
    if (paths.length) actionDownloadZip(paths);
  });

  $("nukeBtn")?.addEventListener("click", () => actionDeleteAll());

  updateCount();
}

/* ============================================================
   DOWNLOAD SELECTED FILES AS ZIP
   Uses JSZip (loaded from CDN in index.html) to fetch each
   selected file via /read-file, pack them, and trigger download.
   Only files are downloaded — folders are excluded.
   ============================================================ */
async function actionDownloadZip(paths) {
  if (!ensureRepo() || !paths.length) return;

  if (typeof JSZip === "undefined") {
    toast("JSZip library not loaded — check your internet connection and reload the page.", "error");
    return;
  }

  const repoSlug = (state.repo || "repo").replace(/[^a-z0-9_-]/gi, "_");
  const zipName  = `${repoSlug}_files_${Date.now()}.zip`;

  // Show progress panel
  setPanel(`Downloading ${paths.length} file(s) — preparing ZIP…`, `
    <div class="folder-summary">
      ${cell("Files", paths.length)}
      ${cell("Repo", escapeHtml(`${state.username}/${state.repo}`))}
      ${cell("Output", escapeHtml(zipName))}
      ${cell("Status", `<span id="pgStatus">Fetching files…</span>`)}
    </div>
    <div class="progress-shell"><div class="progress-fill" id="pgFill" style="width:0%"></div></div>
    <div id="pgLog" style="font-size:12px;color:var(--text-dim);margin-top:10px;max-height:280px;overflow-y:auto;padding:0 2px"></div>
  `);

  const zip = new JSZip();
  let done  = 0;
  let errors = 0;
  const logEl = () => $("pgLog");

  for (const path of paths) {
    const pct = Math.round((done / paths.length) * 90);
    if ($("pgFill"))   $("pgFill").style.width = pct + "%";
    if ($("pgStatus")) $("pgStatus").textContent = `Fetching ${done + 1}/${paths.length}: ${path}`;

    try {
      const data = await api(`/read-file?path=${encodeURIComponent(path)}`, {}, { retries: 1 });
      const f = data.file;
      if (f.is_binary) {
        // content is base64-encoded
        zip.file(path, f.content, { base64: true });
      } else {
        zip.file(path, f.content);
      }
      if (logEl()) logEl().innerHTML += `<div><span style="color:var(--success)">✓</span> ${escapeHtml(path)}</div>`;
    } catch (e) {
      errors++;
      if (logEl()) logEl().innerHTML += `<div><span style="color:var(--danger)">✕</span> ${escapeHtml(path)} — ${escapeHtml(e.message)}</div>`;
    }
    done++;
  }

  if ($("pgStatus")) $("pgStatus").textContent = "Generating ZIP archive…";
  if ($("pgFill"))   $("pgFill").style.width = "95%";

  try {
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });

    // Trigger browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--success)">✓ ZIP ready — ${done - errors} file(s), ${errors} error(s)</span>`;

    const msg = errors > 0
      ? `ZIP downloaded with ${errors} error(s) — check the log above`
      : `ZIP downloaded: ${done} file(s)`;
    toast(msg, errors > 0 ? "error" : "success");
  } catch (e) {
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--danger)">✕ ZIP generation failed: ${escapeHtml(e.message)}</span>`;
    toast("ZIP generation failed: " + e.message, "error");
  }
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
    // Detect root folder name from webkitRelativePath
    const firstRel = files[0].webkitRelativePath || files[0].name;
    rootFolder = firstRel.includes("/") ? firstRel.split("/")[0] : "";

    items = files.map(f => {
      // webkitRelativePath = "rootFolder/sub/file.js"
      // We keep the FULL path including rootFolder so the directory
      // structure is completely preserved in the repo.
      let rel = f.webkitRelativePath || f.name;
      // Normalise: strip any leading slash the browser might add
      rel = rel.replace(/^\/+/, "");
      return { file: f, rel };
    })
    .filter(x => x.rel && !x.rel.endsWith("/"))
    .filter(x => !x.rel.split("/").some(
      seg => seg === ".git" || seg === "node_modules" || seg === "__pycache__"
    ));
  } else {
    items = files.map(f => ({ file: f, rel: f.name }));
  }

  if (!items.length) return toast("No files found", "error");

  const totalBytes = items.reduce((s, x) => s + x.file.size, 0);
  const title      = isFolder
    ? `Upload Folder: ${rootFolder || "selected folder"}`
    : `Upload ${items.length} File${items.length > 1 ? "s" : ""}`;

  // FIX: default target is the current browse path, NOT rootFolder, because
  // rootFolder is already baked into every item's `rel` path.
  // If the user is browsing a subdirectory, drop files there; otherwise root.
  const defaultBase = state.currentPath || "";

  // Build a preview of the first few destination paths
  function buildPreview(base) {
    const prefix = base ? base.replace(/\/+$/, "") + "/" : "";
    return items.slice(0, 5).map(it =>
      `<div style="font-family:monospace;font-size:11px;color:var(--text-dim);padding:1px 0">
        ${escapeHtml(prefix + it.rel)}
      </div>`
    ).join("") + (items.length > 5
      ? `<div style="font-size:11px;color:var(--text-dim);padding:2px 0 0">…and ${items.length - 5} more</div>`
      : "");
  }

  openModal({
    title,
    bodyHtml: `
      <p style="margin:0 0 12px;color:var(--text-dim)">
        <b>${items.length}</b> file${items.length > 1 ? "s" : ""} &nbsp;·&nbsp; ${formatBytes(totalBytes)}
        ${rootFolder ? ` &nbsp;·&nbsp; from <span class="user-tag">${escapeHtml(rootFolder)}</span>` : ""}.
      </p>
      <div class="form-row">
        <label>Target directory in repo <span style="font-weight:400;color:var(--text-dim)">(optional — leave empty for repo root)</span></label>
        <input id="fBase" placeholder="e.g.  src/libs  or leave empty" value="${escapeAttr(defaultBase)}" autocomplete="off" />
        <span class="hint">
          ${isFolder
            ? `The entire folder structure inside <b>${escapeHtml(rootFolder || "folder")}</b> is preserved automatically.`
            : "Files are placed directly inside this directory."}
        </span>
      </div>
      <div class="form-row">
        <label>Destination preview</label>
        <div id="pathPreview" style="background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:6px;padding:8px 10px;min-height:32px">
          ${buildPreview(defaultBase)}
        </div>
      </div>
      <div class="form-row">
        <label>Commit message</label>
        <input id="fBaseMsg" value="GITPUSH: ${isFolder ? `upload folder ${rootFolder}` : "upload files"}" />
      </div>
    `,
    footer: [
      { label: "Cancel", onClick: (close) => close() },
      { label: `Upload ${items.length} file${items.length > 1 ? "s" : ""}`, className: "primary", onClick: (close) => {
          const baseDir   = $("fBase").value.trim().replace(/^\/+|\/+$/g, "");
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

  // Live-update the path preview when the user changes the base dir field
  setTimeout(() => {
    const fBase = $("fBase");
    const preview = $("pathPreview");
    if (!fBase || !preview) return;
    fBase.addEventListener("input", () => {
      preview.innerHTML = buildPreview(fBase.value.trim().replace(/^\/+|\/+$/g, ""));
    });
  }, 30);
}

/* ============================================================
   Single file upload — multipart/form-data streaming
   ============================================================ */
// Per-file threshold: files larger than this always use the streaming path
const STREAM_THRESHOLD  = 2 * 1024 * 1024;   // 2 MB
// Total-batch threshold: switch entire batch to streaming if combined
// payload would be too large for a single JSON request
const STREAM_TOTAL      = 5 * 1024 * 1024;   // 5 MB total
const HARD_GITHUB_LIMIT = 100 * 1024 * 1024; // 100 MB GitHub max

function cancelUpload() {
  if (state.uploadAbort) {
    state.uploadAbort.abort();
    state.uploadAbort = null;
  }
}

async function runSingleFileUpload(item, baseDir, msgPrefix) {
  const fullPath = (baseDir ? baseDir.replace(/\/+$/, "") + "/" : "") + item.rel;
  if (item.file.size > HARD_GITHUB_LIMIT) {
    toast(`File is ${formatBytes(item.file.size)} — GitHub REST only accepts ≤100 MB. Use Git LFS for larger files.`, "error");
    return;
  }
  setPanel(`Uploading · ${item.rel}`, `
    <div class="folder-summary">
      ${cell("File", escapeHtml(fullPath))}
      ${cell("Size", formatBytes(item.file.size))}
      ${cell("Mode", item.file.size > STREAM_THRESHOLD ? "Streaming (multipart)" : "Inline (JSON)")}
      ${cell("Status", `<span id="pgStatus">Preparing…</span>`)}
    </div>
    <div class="progress-shell"><div class="progress-fill" id="pgFill" style="width:0%"></div></div>
    <div id="pgLog" style="font-size:12px;color:var(--text-dim);margin-top:10px;padding:0 2px"></div>
  `);
  return uploadFileStreamXHR(item, fullPath, msgPrefix);
}

function uploadFileStreamXHR(item, fullPath, msgPrefix) {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.append("file",      item.file, item.rel);
    fd.append("path",      fullPath);
    fd.append("message",   `${msgPrefix} ${item.rel}`);
    fd.append("overwrite", "1");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload-file-stream");
    xhr.setRequestHeader("X-Gitpush-Username", state.username || "");
    xhr.setRequestHeader("X-Gitpush-Repo",     state.repo     || "");
    xhr.timeout = 15 * 60 * 1000;

    let lastPct = -1;
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 88);
      if (pct === lastPct) return;
      lastPct = pct;
      if ($("pgFill"))   $("pgFill").style.width = pct + "%";
      if ($("pgStatus")) $("pgStatus").textContent =
        `Uploading… ${formatBytes(e.loaded)} / ${formatBytes(e.total)} (${pct}%)`;
    };
    xhr.upload.onload = () => {
      if ($("pgFill"))   $("pgFill").style.width = "90%";
      if ($("pgStatus")) $("pgStatus").textContent = "Server is committing to GitHub…";
    };
    xhr.onload    = () => finishXHR(xhr, fullPath, resolve);
    xhr.onerror   = () => finishXHRError(xhr, "Network error — connection dropped or server unreachable.", resolve);
    xhr.ontimeout = () => finishXHRError(xhr, "Upload timed out after 15 minutes.", resolve);
    xhr.onabort   = () => finishXHRError(xhr, "Upload was cancelled.", resolve);
    xhr.send(fd);
  });
}

function finishXHR(xhr, fullPath, resolve) {
  let data = {};
  const raw = xhr.responseText || "";
  try { data = JSON.parse(raw); } catch (_) {}
  const ok = xhr.status >= 200 && xhr.status < 300 && data.ok !== false;
  if (ok) {
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--success)">✓ Done — commit <b>${(data.commit||"").slice(0,7)}</b></span>`;
    toast(`${data.action === "create" ? "Created" : "Updated"} ${fullPath}`, "success");
    refreshInfo({ silent: true }).catch(() => {});
    setTimeout(() => actionListFiles(state.currentPath || pathDir(fullPath)), 600);
  } else {
    let msg = data.error;
    if (!msg) {
      const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 220);
      msg = snippet ? `Server error ${xhr.status}: ${snippet}` : `Upload failed (${xhr.status})`;
    }
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML = `<span style="color:var(--danger)">✕ ${escapeHtml(msg)}</span>`;
    if (data.trace && $("pgLog")) {
      $("pgLog").innerHTML =
        `<details open><summary style="cursor:pointer;color:var(--text-dim)">Server traceback</summary>` +
        `<pre style="white-space:pre-wrap;font-size:11px;background:rgba(239,0,0,.06);padding:8px;border-radius:6px;margin:6px 0;max-height:240px;overflow:auto">${escapeHtml(data.trace)}</pre>` +
        `</details>`;
    }
    toast(msg, "error");
  }
  resolve();
}

function finishXHRError(xhr, msg, resolve) {
  if ($("pgFill"))   $("pgFill").style.width = "100%";
  if ($("pgStatus")) $("pgStatus").innerHTML = `<span style="color:var(--danger)">✕ ${escapeHtml(msg)}</span>`;
  toast(msg, "error");
  resolve();
}

/* ============================================================
   Folder upload — routes to inline (small files) or streaming
   ============================================================ */
async function runFolderUpload(items, baseDir, msgPrefix) {
  const total = items.length;

  const tooBig = items.find(it => it.file.size > HARD_GITHUB_LIMIT);
  if (tooBig) {
    toast(`"${tooBig.rel}" is ${formatBytes(tooBig.file.size)} — GitHub REST only accepts ≤100 MB per file.`, "error");
    return;
  }

  const hasLarge   = items.some(it => it.file.size > STREAM_THRESHOLD);
  const totalBytes = items.reduce((s, it) => s + it.file.size, 0);
  // Also stream when total payload would be too large for a single JSON body
  const useStream  = hasLarge || totalBytes > STREAM_TOTAL;
  const modeLabel  = useStream ? "Streaming (concurrent × 3)" : "Inline batch";

  // Set up a fresh abort controller for this upload session
  cancelUpload();
  const ctrl = new AbortController();
  state.uploadAbort = ctrl;

  setPanel(`Uploading · ${total} file(s) — preparing…`, `
    <div class="folder-summary">
      ${cell("Total files", total)}
      ${cell("Total size",  formatBytes(totalBytes))}
      ${cell("Target",      escapeHtml(baseDir || "(repo root)"))}
      ${cell("Mode",        modeLabel)}
      ${cell("Status",      `<span id="pgStatus">Starting…</span>`)}
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <div class="progress-shell" style="flex:1"><div class="progress-fill" id="pgFill" style="width:0%"></div></div>
      <button id="cancelUploadBtn" class="ghost-btn" style="white-space:nowrap;font-size:12px" onclick="cancelUpload();this.disabled=true;this.textContent='Cancelling…'">Cancel</button>
    </div>
    <div id="pgLog" style="font-size:12px;color:var(--text-dim);margin-top:4px;max-height:300px;overflow-y:auto;padding:0 2px"></div>
  `);

  if (useStream) {
    return runFolderUploadStream(items, baseDir, msgPrefix, totalBytes, ctrl);
  }
  return runFolderUploadInline(items, baseDir, msgPrefix, ctrl);
}

/* ---------- Inline (small files ≤5 MB total, single JSON commit) ----------
   Reads files in batches of 10 to avoid pinning too much memory at once.
   Respects the AbortController so Cancel works mid-read.
   -------------------------------------------------------------------- */
async function runFolderUploadInline(items, baseDir, msgPrefix, ctrl) {
  const total       = items.length;
  const filePayload = [];
  let   readDone    = 0;
  const BATCH       = 10;

  for (let i = 0; i < items.length; i += BATCH) {
    if (ctrl?.signal.aborted) {
      if ($("pgStatus")) $("pgStatus").innerHTML =
        `<span style="color:var(--warning)">⊘ Cancelled after reading ${readDone} / ${total} files</span>`;
      toast("Upload cancelled", "error");
      return;
    }

    const batch = items.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(it => fileToBase64(it.file).then(content => ({ path: it.rel, content })))
    );

    for (let j = 0; j < results.length; j++) {
      readDone++;
      const r = results[j];
      if (r.status === "fulfilled") {
        filePayload.push(r.value);
      } else {
        const logEl = $("pgLog");
        if (logEl) logEl.innerHTML +=
          `<div style="color:var(--danger)">✕ Read error: ${escapeHtml(batch[j].rel)}</div>`;
      }
      if ($("pgFill"))   $("pgFill").style.width = `${Math.round((readDone / total) * 50)}%`;
      if ($("pgStatus")) $("pgStatus").textContent = `Reading files… ${readDone}/${total}`;
    }
  }

  if (!filePayload.length) { toast("No files could be read", "error"); return; }
  if (ctrl?.signal.aborted) {
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--warning)">⊘ Cancelled (read phase completed, upload not started)</span>`;
    toast("Upload cancelled", "error");
    return;
  }

  if ($("pgStatus")) $("pgStatus").textContent = `Committing ${filePayload.length} files to GitHub…`;
  if ($("pgFill"))   $("pgFill").style.width = "60%";

  try {
    const data = await api("/upload-folder-atomic", {
      method: "POST",
      body: JSON.stringify({
        files:    filePayload,
        base_dir: baseDir,
        message:  `${msgPrefix} (${filePayload.length} files)`,
      }),
    }, { retries: 1, signal: ctrl?.signal });

    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--success)">✓ Done — commit <b>${(data.commit||"").slice(0,7)}</b></span>`;
    const logEl = $("pgLog");
    if (logEl) logEl.innerHTML = filePayload.map(f =>
      `<div><span style="color:var(--success)">✓</span> ${escapeHtml(f.path)}</div>`
    ).join("");
    disableCancelBtn();
    toast(`✓ Uploaded ${data.files_count} file(s) in 1 commit`, "success");
    refreshInfo({ silent: true }).catch(() => {});
    setTimeout(() => actionListFiles(state.currentPath || ""), 600);
  } catch (e) {
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    const cancelled = e.name === "AbortError";
    if ($("pgStatus")) $("pgStatus").innerHTML = cancelled
      ? `<span style="color:var(--warning)">⊘ Upload cancelled</span>`
      : `<span style="color:var(--danger)">✕ Failed: ${escapeHtml(e.message)}</span>`;
    toast(cancelled ? "Upload cancelled" : e.message, cancelled ? "" : "error");
  }
}

function disableCancelBtn() {
  const btn = $("cancelUploadBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Done"; }
  state.uploadAbort = null;
}

/* ---------- Streaming (large files OR >5 MB total, concurrent blobs) ------
   Runs up to 3 blob uploads in parallel.  Individual errors don't abort the
   batch — successes are committed atomically at the end.
   Supports AbortController (Cancel button) and shows a Retry button for
   any files that failed.
   ------------------------------------------------------------------- */
async function runFolderUploadStream(items, baseDir, msgPrefix, totalBytes, ctrl) {
  const total       = items.length;
  const CONCURRENCY = 3;
  const logEl       = $("pgLog");

  // Pre-create one row per file for a stable display
  if (logEl) {
    logEl.innerHTML = items.map((it, i) =>
      `<div id="pglog_${i}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">` +
      `⋯ ${escapeHtml(it.rel)} <span style="color:var(--text-dim)">(${formatBytes(it.file.size)})</span></div>`
    ).join("");
  }

  let bytesSent = 0;
  let completed = 0;
  const blobs   = [];   // { idx, path, sha }
  const errors  = [];   // { idx, rel, msg, item }

  async function worker(queue) {
    while (queue.length > 0) {
      if (ctrl?.signal.aborted) return;
      const { it, idx } = queue.shift();
      const lineEl = () => $(`pglog_${idx}`);

      if (lineEl()) lineEl().innerHTML =
        `⟳ <b>${escapeHtml(it.rel)}</b> — uploading…`;

      try {
        const sha = await uploadBlobStreamXHR(it, (sent) => {
          const cur = bytesSent + sent;
          const pct = Math.round((cur / totalBytes) * 88);
          if ($("pgFill")) $("pgFill").style.width = Math.min(pct, 88) + "%";
        });

        bytesSent += it.file.size;
        blobs.push({ idx, path: it.rel, sha });
        completed++;

        if ($("pgStatus")) $("pgStatus").textContent =
          `Uploading… ${completed}/${total} done`;
        if (lineEl()) lineEl().innerHTML =
          `<span style="color:var(--success)">✓</span> ${escapeHtml(it.rel)}` +
          ` <span style="color:var(--text-dim);font-size:10px">${sha.slice(0,7)}</span>`;

      } catch (e) {
        completed++;
        errors.push({ idx, rel: it.rel, msg: e.message || "failed", item: it });
        if (lineEl()) lineEl().innerHTML =
          `<span style="color:var(--danger)">✕</span> ${escapeHtml(it.rel)}` +
          ` — <span style="color:var(--danger)">${escapeHtml(e.message || "failed")}</span>`;
      }
    }
  }

  const queue = items.map((it, idx) => ({ it, idx }));
  const pool  = Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker(queue));
  await Promise.all(pool);

  // Cancelled mid-upload?
  if (ctrl?.signal.aborted) {
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--warning)">⊘ Cancelled — ${blobs.length} blob(s) uploaded but NOT committed</span>`;
    toast(`Upload cancelled — nothing committed`, "error");
    disableCancelBtn();
    return;
  }

  if (!blobs.length) {
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--danger)">✕ All ${total} files failed. Check the errors above.</span>`;
    toast(`All uploads failed — no commit made`, "error");
    disableCancelBtn();
    return;
  }

  blobs.sort((a, b) => a.idx - b.idx);

  if ($("pgStatus")) $("pgStatus").textContent = `Committing ${blobs.length} file(s) to GitHub…`;
  if ($("pgFill"))   $("pgFill").style.width = "92%";

  try {
    const data = await api("/commit-tree", {
      method: "POST",
      body: JSON.stringify({
        blobs:    blobs.map(b => ({ path: b.path, sha: b.sha })),
        base_dir: baseDir,
        message:  `${msgPrefix} (${blobs.length} files)`,
      }),
    }, { retries: 1 });

    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--success)">✓ Done — commit <b>${(data.commit||"").slice(0,7)}</b>` +
      (errors.length
        ? ` · <span style="color:var(--warning)">${errors.length} file(s) failed</span>`
        : "") +
      `</span>`;

    disableCancelBtn();

    if (errors.length) {
      // Show a retry button for the failed files
      const logEl2 = $("pgLog");
      if (logEl2) {
        const failedItems = errors.map(er => er.item);
        logEl2.insertAdjacentHTML("beforeend",
          `<div style="margin-top:10px">
            <button id="retryFailedBtn" class="ghost-btn" style="font-size:12px">
              ↺ Retry ${errors.length} failed file(s)
            </button>
          </div>`);
        $("retryFailedBtn")?.addEventListener("click", () => {
          runFolderUpload(failedItems, baseDir, msgPrefix);
        });
      }
      toast(`✓ ${blobs.length}/${total} uploaded — ${errors.length} failed (retry button shown)`, "error");
    } else {
      toast(`✓ Uploaded ${blobs.length} file(s) in 1 commit`, "success");
    }

    refreshInfo({ silent: true }).catch(() => {});
    setTimeout(() => actionListFiles(state.currentPath || ""), 600);
  } catch (e) {
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    const cancelled = e.name === "AbortError";
    if ($("pgStatus")) $("pgStatus").innerHTML = cancelled
      ? `<span style="color:var(--warning)">⊘ Commit cancelled</span>`
      : `<span style="color:var(--danger)">✕ Commit failed: ${escapeHtml(e.message)}</span>`;
    toast(cancelled ? "Commit cancelled" : `Commit failed: ${e.message}`, cancelled ? "" : "error");
    disableCancelBtn();
  }
}

/* Single-blob multipart upload — returns the blob SHA */
function uploadBlobStreamXHR(item, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", item.file, item.rel);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/create-blob-stream");
    xhr.setRequestHeader("X-Gitpush-Username", state.username || "");
    xhr.setRequestHeader("X-Gitpush-Repo",     state.repo     || "");
    xhr.timeout = 15 * 60 * 1000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded);
    };
    xhr.onload = () => {
      let data = {};
      const raw = xhr.responseText || "";
      try { data = JSON.parse(raw); } catch (_) {}
      const ok = xhr.status >= 200 && xhr.status < 300 && data.ok !== false;
      if (ok && data.sha) return resolve(data.sha);
      let msg = data.error;
      if (!msg) {
        const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 220);
        msg = snippet ? `Server error ${xhr.status}: ${snippet}` : `Blob upload failed (${xhr.status})`;
      }
      reject(new Error(msg));
    };
    xhr.onerror   = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out (15 min)"));
    xhr.onabort   = () => reject(new Error("Upload cancelled"));
    xhr.send(fd);
  });
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

/* ---------- Bulk / single delete ---------- */
async function actionDeleteSelected(items) {
  if (!ensureRepo()) return;
  if (!items?.length) return;
  const hasDir = items.some(i => i.type === "dir");
  const list = items.slice(0, 8).map(i => `• ${escapeHtml(i.path)}${i.type === 'dir' ? ' /' : ''}`).join("<br>");
  const more = items.length > 8 ? `<br><span class="muted">…and ${items.length - 8} more</span>` : "";

  const ok = await openConfirm({
    title:       items.length === 1 ? "Delete this item?" : `Delete ${items.length} items?`,
    message:     `${list}${more}${hasDir ? `<br><br><span class="muted">Folders are deleted recursively.</span>` : ""}`,
    okLabel:     items.length === 1 ? "Delete" : `Delete ${items.length}`,
    cancelLabel: "Cancel",
    danger:      true,
    icon:        "🗑",
  });
  if (!ok) return;

  try {
    showLoader("Deleting…");
    const data = await api("/delete-many", {
      method: "POST",
      body: JSON.stringify({
        paths:     items.map(i => i.path),
        recursive: true,
        message:   `GITPUSH: delete ${items.length} item(s)`,
      }),
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
    okLabel:     "Yes, Delete All",
    cancelLabel: "Cancel",
    danger:      true,
    icon:        "⚠",
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

/* ---------- Repo info / Git status ---------- */
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
        Branch <b style="color:var(--accent-3)">${escapeHtml(data.branch)}</b>
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
    if (act === "list")          actionListFiles(state.currentPath || "");
    if (act === "upload")        actionUploadFile();
    if (act === "upload-folder") actionUploadFolder();
    if (act === "upload-zip")    actionUploadZip();
    if (act === "info")          actionRepoInfo();
    if (act === "status")        actionGitStatus();
    if (act === "change")        actionChangeRepo();
    if (act === "change-user")   actionChangeUsername();
    if (act === "refresh")       actionRefresh();
  });
});

/* ---------- Utils ---------- */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[m]);
}
function escapeAttr(s) { return escapeHtml(s); }

/* ---------- Boot ---------- */
loadInitialContext();

/* ============================================================
   ZIP Upload — extract & push all files inside a .zip to GitHub
   Uses JSZip (already loaded from CDN for download feature).
   ============================================================ */
function actionUploadZip() {
  if (!ensureRepo()) return;
  if (typeof JSZip === "undefined") {
    toast("JSZip library not loaded — check your internet connection and reload.", "error");
    return;
  }
  const picker = $("zipPicker");
  picker.value = "";
  picker.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast("Please select a .zip file", "error");
      return;
    }

    // Read ZIP entries
    let zip;
    try {
      showLoader("Reading ZIP…");
      const buffer = await file.arrayBuffer();
      zip = await JSZip.loadAsync(buffer);
    } catch (err) {
      toast("Could not read ZIP: " + err.message, "error");
      hideLoader();
      return;
    } finally {
      hideLoader();
    }

    // Collect non-directory entries, skip .git / node_modules / __pycache__
    const entries = [];
    zip.forEach((relPath, zipEntry) => {
      if (zipEntry.dir) return;
      const segments = relPath.split("/");
      if (segments.some(s => s === ".git" || s === "node_modules" || s === "__pycache__")) return;
      entries.push({ rel: relPath, zipEntry });
    });

    if (!entries.length) {
      toast("ZIP is empty or contains no eligible files", "error");
      return;
    }

    const defaultBase = state.currentPath || "";
    const totalLabel = `${entries.length} file${entries.length > 1 ? "s" : ""} inside <b>${escapeHtml(file.name)}</b>`;

    function buildZipPreview(base) {
      const prefix = base ? base.replace(/\/+$/, "") + "/" : "";
      return entries.slice(0, 5).map(it =>
        `<div style="font-family:monospace;font-size:11px;color:var(--text-dim);padding:1px 0">
          ${escapeHtml(prefix + it.rel)}
        </div>`
      ).join("") + (entries.length > 5
        ? `<div style="font-size:11px;color:var(--text-dim);padding:2px 0 0">…and ${entries.length - 5} more</div>`
        : "");
    }

    openModal({
      title: `Upload ZIP: ${file.name}`,
      bodyHtml: `
        <p style="margin:0 0 12px;color:var(--text-dim)">
          Found ${totalLabel}.
        </p>
        <div class="form-row">
          <label>Target directory in repo <span style="font-weight:400;color:var(--text-dim)">(optional — leave empty for repo root)</span></label>
          <input id="fBase" placeholder="e.g.  src/libs  or leave empty" value="${escapeAttr(defaultBase)}" autocomplete="off" />
          <span class="hint">The full folder structure inside the ZIP is preserved automatically.</span>
        </div>
        <div class="form-row">
          <label>Destination preview</label>
          <div id="zipPathPreview" style="background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:6px;padding:8px 10px;min-height:32px">
            ${buildZipPreview(defaultBase)}
          </div>
        </div>
        <div class="form-row">
          <label>Commit message</label>
          <input id="fBaseMsg" value="GITPUSH: extract ${escapeAttr(file.name)}" />
        </div>
      `,
      footer: [
        { label: "Cancel", onClick: (close) => close() },
        { label: `Upload ${entries.length} file${entries.length > 1 ? "s" : ""}`, className: "primary", onClick: (close) => {
            const baseDir   = $("fBase").value.trim().replace(/^\/+|\/+$/g, "");
            const msgPrefix = $("fBaseMsg").value.trim() || "GITPUSH: extract zip";
            close();
            runZipUpload(entries, baseDir, msgPrefix);
        }},
      ],
    });

    setTimeout(() => {
      const fBase = $("fBase");
      const preview = $("zipPathPreview");
      if (!fBase || !preview) return;
      fBase.addEventListener("input", () => {
        preview.innerHTML = buildZipPreview(fBase.value.trim().replace(/^\/+|\/+$/g, ""));
      });
    }, 30);
  };
  picker.click();
}

async function runZipUpload(entries, baseDir, msgPrefix) {
  const total = entries.length;

  cancelUpload();
  const ctrl = new AbortController();
  state.uploadAbort = ctrl;

  setPanel(`Uploading ZIP · ${total} file(s)`, `
    <div class="folder-summary">
      ${cell("Total files", total)}
      ${cell("Target", escapeHtml(baseDir || "(repo root)"))}
      ${cell("Status", `<span id="pgStatus">Reading ZIP entries…</span>`)}
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <div class="progress-shell" style="flex:1"><div class="progress-fill" id="pgFill" style="width:0%"></div></div>
      <button id="cancelUploadBtn" class="ghost-btn" style="white-space:nowrap;font-size:12px" onclick="cancelUpload();this.disabled=true;this.textContent='Cancelling…'">Cancel</button>
    </div>
    <div id="pgLog" style="font-size:12px;color:var(--text-dim);margin-top:4px;max-height:300px;overflow-y:auto;padding:0 2px"></div>
  `);

  // Decode all entries to base64
  const filePayload = [];
  const BATCH = 10;
  let readDone = 0;

  for (let i = 0; i < entries.length; i += BATCH) {
    if (ctrl?.signal.aborted) {
      if ($("pgStatus")) $("pgStatus").innerHTML =
        `<span style="color:var(--warning)">⊘ Cancelled after reading ${readDone} / ${total} files</span>`;
      toast("Upload cancelled", "error");
      return;
    }

    const batch = entries.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async it => {
        const bytes = await it.zipEntry.async("uint8array");
        // Convert to base64
        let binary = "";
        for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
        const b64 = btoa(binary);
        return { path: it.rel, content: b64 };
      })
    );

    for (let j = 0; j < results.length; j++) {
      readDone++;
      const r = results[j];
      if (r.status === "fulfilled") {
        filePayload.push(r.value);
      } else {
        const logEl = $("pgLog");
        if (logEl) logEl.innerHTML +=
          `<div style="color:var(--danger)">✕ Read error: ${escapeHtml(batch[j].rel)}</div>`;
      }
      if ($("pgFill"))   $("pgFill").style.width = `${Math.round((readDone / total) * 50)}%`;
      if ($("pgStatus")) $("pgStatus").textContent = `Reading… ${readDone}/${total}`;
    }
  }

  if (!filePayload.length) { toast("No files could be read from ZIP", "error"); return; }
  if (ctrl?.signal.aborted) {
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--warning)">⊘ Cancelled (read phase done, upload not started)</span>`;
    toast("Upload cancelled", "error");
    return;
  }

  if ($("pgStatus")) $("pgStatus").textContent = `Committing ${filePayload.length} files to GitHub…`;
  if ($("pgFill"))   $("pgFill").style.width = "60%";

  try {
    const data = await api("/upload-folder-atomic", {
      method: "POST",
      body: JSON.stringify({
        files:    filePayload,
        base_dir: baseDir,
        message:  `${msgPrefix} (${filePayload.length} files)`,
      }),
    }, { retries: 1, signal: ctrl?.signal });

    if ($("pgFill"))   $("pgFill").style.width = "100%";
    if ($("pgStatus")) $("pgStatus").innerHTML =
      `<span style="color:var(--success)">✓ Done — commit <b>${(data.commit||"").slice(0,7)}</b></span>`;
    const logEl = $("pgLog");
    if (logEl) logEl.innerHTML = filePayload.map(f =>
      `<div><span style="color:var(--success)">✓</span> ${escapeHtml(f.path)}</div>`
    ).join("");
    disableCancelBtn();
    toast(`✓ Extracted & uploaded ${data.files_count} file(s) from ZIP`, "success");
    refreshInfo({ silent: true }).catch(() => {});
    setTimeout(() => actionListFiles(state.currentPath || ""), 600);
  } catch (e) {
    if ($("pgFill"))   $("pgFill").style.width = "100%";
    const cancelled = e.name === "AbortError";
    if ($("pgStatus")) $("pgStatus").innerHTML = cancelled
      ? `<span style="color:var(--warning)">⊘ Upload cancelled</span>`
      : `<span style="color:var(--danger)">✕ Failed: ${escapeHtml(e.message)}</span>`;
    toast(cancelled ? "Upload cancelled" : e.message, cancelled ? "" : "error");
  }
  state.uploadAbort = null;
}

/* ============================================================
   Drag & Drop — supports files AND folders with full structure
   Uses FileSystemEntry API (webkitGetAsEntry) which all modern
   browsers support. Works on Chrome, Firefox, Edge, Safari 11.1+
   ============================================================ */

(function initDragDrop() {
  const panel   = document.getElementById("outputPanel");
  const overlay = document.getElementById("dropOverlay");
  if (!panel || !overlay) return;

  let dragCounter = 0; // track nested dragenter/dragleave

  panel.addEventListener("dragenter", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    overlay.classList.add("active");
  });

  panel.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.classList.remove("active");
    }
  });

  panel.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  });

  panel.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    overlay.classList.remove("active");

    if (!window.state?.repo) {
      toast("Connect a repository first", "error");
      return;
    }

    const dtItems = Array.from(e.dataTransfer.items || []);
    if (!dtItems.length) return;

    // Check if any item is a directory (requires FileSystemEntry API)
    const hasDir = dtItems.some(it => {
      const entry = it.webkitGetAsEntry?.();
      return entry && entry.isDirectory;
    });

    showLoader("Reading dropped items…");

    try {
      const items = await readDroppedItems(dtItems);
      if (!items.length) {
        toast("No files found in dropped items", "error");
        return;
      }
      hideLoader();
      // Reuse the same modal flow as Upload Folder
      showDroppedFilesModal(items, hasDir);
    } catch (err) {
      hideLoader();
      toast("Error reading dropped items: " + err.message, "error");
    }
  });

  /* ---- Recursively read all dropped entries ---- */
  async function readDroppedItems(dtItems) {
    const SKIP_DIRS = new Set([".git", "node_modules", "__pycache__", ".DS_Store"]);
    const results   = [];

    async function readEntry(entry, pathPrefix) {
      if (!entry) return;
      const fullPath = pathPrefix ? pathPrefix + "/" + entry.name : entry.name;

      // Skip junk
      if (SKIP_DIRS.has(entry.name)) return;

      if (entry.isFile) {
        const file = await new Promise((res, rej) => entry.file(res, rej));
        results.push({ file, rel: fullPath });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        // createReader reads in batches of 100 — must loop until empty
        let batch;
        do {
          batch = await new Promise((res, rej) => reader.readEntries(res, rej));
          for (const child of batch) {
            await readEntry(child, fullPath);
          }
        } while (batch.length > 0);
      }
    }

    for (const dtItem of dtItems) {
      if (dtItem.kind !== "file") continue;
      const entry = dtItem.webkitGetAsEntry?.();
      if (entry) {
        await readEntry(entry, "");
      } else {
        // Fallback: no FileSystemEntry support — use plain File object
        const file = dtItem.getAsFile?.();
        if (file) results.push({ file, rel: file.name });
      }
    }

    return results.filter(x => x.rel && !x.rel.endsWith("/"));
  }

  /* ---- Modal identical to handleFilesPicked ---- */
  function showDroppedFilesModal(items, hasDir) {
    const totalBytes  = items.reduce((s, x) => s + x.file.size, 0);
    const defaultBase = state.currentPath || "";

    function buildPreview(base) {
      const prefix = base ? base.replace(/\/+$/, "") + "/" : "";
      return items.slice(0, 5).map(it =>
        `<div style="font-family:monospace;font-size:11px;color:var(--text-dim);padding:1px 0">
          ${escapeHtml(prefix + it.rel)}
        </div>`
      ).join("") + (items.length > 5
        ? `<div style="font-size:11px;color:var(--text-dim);padding:2px 0 0">…and ${items.length - 5} more</div>`
        : "");
    }

    openModal({
      title: `Upload ${items.length} dropped item${items.length > 1 ? "s" : ""}`,
      bodyHtml: `
        <p style="margin:0 0 12px;color:var(--text-dim)">
          <b>${items.length}</b> file${items.length > 1 ? "s" : ""} &nbsp;·&nbsp; ${formatBytes(totalBytes)}
          ${hasDir ? " &nbsp;·&nbsp; <span style=\"color:var(--success)\">✓ folder structure preserved</span>" : ""}
        </p>
        <div class="form-row">
          <label>Target directory in repo <span style="font-weight:400;color:var(--text-dim)">(optional)</span></label>
          <input id="fBase" placeholder="e.g. src/libs or leave empty" value="${escapeAttr(defaultBase)}" autocomplete="off" />
          <span class="hint">Folder paths inside dropped items are preserved automatically.</span>
        </div>
        <div class="form-row">
          <label>Destination preview</label>
          <div id="pathPreview" style="background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:6px;padding:8px 10px;min-height:32px">
            ${buildPreview(defaultBase)}
          </div>
        </div>
        <div class="form-row">
          <label>Commit message</label>
          <input id="fBaseMsg" value="GITPUSH: drag & drop upload (${items.length} files)" />
        </div>
      `,
      footer: [
        { label: "Cancel", onClick: (close) => close() },
        { label: `Upload ${items.length} file${items.length > 1 ? "s" : ""}`, className: "primary", onClick: (close) => {
            const baseDir   = $("fBase").value.trim().replace(/^\/+|\/+$/g, "");
            const msgPrefix = $("fBaseMsg").value.trim() || "GITPUSH: upload";
            close();
            if (items.length === 1 && !hasDir) {
              runSingleFileUpload(items[0], baseDir, msgPrefix);
            } else {
              runFolderUpload(items, baseDir, msgPrefix);
            }
        }},
      ],
    });

    setTimeout(() => {
      const fBase = $("fBase");
      const preview = $("pathPreview");
      if (!fBase || !preview) return;
      fBase.addEventListener("input", () => {
        preview.innerHTML = buildPreview(fBase.value.trim().replace(/^\/+|\/+$/g, ""));
      });
    }, 30);
  }
})();
