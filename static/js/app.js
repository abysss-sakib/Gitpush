/* ============================================================
   GITPUSH · dev.sakib
   Front-end controller (fixed-username + bulk delete edition)
   ============================================================ */

const $ = (id) => document.getElementById(id);
const html = document.documentElement;
const FIXED_USERNAME = window.GITPUSH_USERNAME || "abysss-sakib";

const state = {
  repo: null,
  info: null,
  branch: null,
  currentPath: "",
  lastListing: null,    // last /list-files response (for select-all)
};

/* ---------- Theme ---------- */
const THEME_KEY = "gitpush_theme";
function applyTheme(theme) {
  html.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}
applyTheme(localStorage.getItem(THEME_KEY) || "dark");
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
function showLoader(text = "Working…") {
  $("loaderText").textContent = text;
  $("loader").classList.add("show");
}
function hideLoader() { $("loader").classList.remove("show"); }

/* ---------- API ---------- */
async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const res = await fetch(path, { ...opts, headers });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

/* ---------- Modal ---------- */
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
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ---------- Panel ---------- */
function setPanel(title, bodyHtml) {
  $("panelTitle").textContent = title;
  $("panelBody").innerHTML = bodyHtml;
}
$("clearOutput").addEventListener("click", () => {
  setPanel("Console", `<div class="empty-state"><p>Output cleared.</p></div>`);
});

/* ---------- Repo pill / hero ---------- */
function refreshRepoPill() {
  const pill = $("repoPill");
  const text = $("repoPillText");
  if (state.repo) {
    pill.classList.add("active");
    text.textContent = `${FIXED_USERNAME} / ${state.repo}`;
  } else {
    pill.classList.remove("active");
    text.textContent = `${FIXED_USERNAME} / no repo`;
  }
}
function renderHero(info) {
  if (!info) {
    $("repoTitle").textContent = "Welcome to GITPUSH";
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
  try {
    const data = await api("/repo-context");
    if (data.context && data.context.repo) {
      state.repo = data.context.repo;
      refreshRepoPill();
      await refreshInfo({ silent: true });
    }
  } catch (_) {}
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
        Connected as <span class="user-tag">${FIXED_USERNAME}</span>.
        Just enter the repository name — the username is fixed.
      </p>
      <div class="form-row">
        <label for="inRepo">Repository Name</label>
        <div class="prefix-input">
          <span class="prefix">${FIXED_USERNAME}/</span>
          <input id="inRepo" placeholder="my-awesome-project" value="${state.repo || ''}" autocomplete="off" />
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
              body: JSON.stringify({ repo }),
            });
            state.repo = repo;
            refreshRepoPill();
            close();
            toast(data.message || "Connected", "success");
            await refreshInfo({ silent: false });
            await actionListFiles();
          } catch (e) { toast(e.message, "error"); }
          finally { hideLoader(); }
      }},
    ],
  });
  setTimeout(() => $("inRepo").focus(), 50);
}

/* ---------- File list ---------- */
async function actionListFiles(path = "") {
  if (!ensureRepo()) return;
  try {
    showLoader("Listing files…");
    const data = await api(`/list-files?path=${encodeURIComponent(path)}`);
    state.currentPath = path;
    state.lastListing = data;
    renderFileList(data);
  } catch (e) {
    toast(e.message, "error");
    setPanel("Files", `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`);
  } finally { hideLoader(); }
}

function renderFileList(data) {
  const segments = data.path ? data.path.split("/") : [];
  let crumbs = `<span class="crumb" data-path="">root</span>`;
  let acc = "";
  segments.forEach((seg) => {
    acc = acc ? `${acc}/${seg}` : seg;
    crumbs += `<span class="sep">/</span><span class="crumb" data-path="${escapeAttr(acc)}">${escapeHtml(seg)}</span>`;
  });

  const toolbar = `
    <div class="file-toolbar">
      <label class="cb-row">
        <input type="checkbox" id="selectAll" />
        <span>Select all</span>
      </label>
      <span class="sel-count" id="selCount">0 selected</span>
      <div class="toolbar-spacer"></div>
      <button class="ghost-btn" id="bulkDeleteBtn" disabled>Delete Selected</button>
      <button class="danger-solid" id="nukeBtn" title="Delete every file in the repository">⚠ DELETE ALL</button>
    </div>
  `;

  const rows = data.items.map((it, i) => `
    <div class="file-row" data-path="${escapeAttr(it.path)}" data-type="${it.type}" style="animation-delay:${i * 18}ms">
      <input type="checkbox" class="row-cb" data-path="${escapeAttr(it.path)}" data-type="${it.type}" />
      <span class="icon">
        ${it.type === "dir"
          ? `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 4H2v16h20V6H12z"/></svg>`
          : `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9z"/></svg>`}
      </span>
      <span class="name" title="${escapeAttr(it.path)}">${escapeHtml(it.name)}</span>
      <span class="size">${it.type === "dir" ? "—" : formatSize(Math.round((it.size||0)/1024))}</span>
      <span class="actions-inline">
        ${it.type === "dir"
          ? `<button data-act="open"   data-path="${escapeAttr(it.path)}">Open</button>
             <button data-act="del-dir" data-path="${escapeAttr(it.path)}">Delete</button>`
          : `<button data-act="read"    data-path="${escapeAttr(it.path)}">Read</button>
             <button data-act="replace" data-path="${escapeAttr(it.path)}">Replace</button>
             <button data-act="delete"  data-path="${escapeAttr(it.path)}">Delete</button>`}
      </span>
    </div>
  `).join("");

  const body = data.items.length
    ? `<div class="path-bar">${crumbs}</div>${toolbar}<div class="file-list">${rows}</div>`
    : `<div class="path-bar">${crumbs}</div>${toolbar}<div class="empty-state"><p>No files in this directory.</p></div>`;

  setPanel(`Files · ${data.path || "root"} · ${data.count} item(s)`, body);
  wireFileListInteractions(data);
}

function wireFileListInteractions(data) {
  const panelBody = $("panelBody");

  panelBody.querySelectorAll(".crumb").forEach(el => {
    el.addEventListener("click", () => actionListFiles(el.dataset.path));
  });

  panelBody.querySelectorAll(".file-row .actions-inline button").forEach(btn => {
    btn.addEventListener("click", () => {
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
    const checked = panelBody.querySelectorAll(".row-cb:checked");
    const n = checked.length;
    $("selCount").textContent = `${n} selected`;
    $("bulkDeleteBtn").disabled = n === 0;
    $("bulkDeleteBtn").textContent = n === 0 ? "Delete Selected" : `Delete Selected (${n})`;
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

/* ---------- Read / Upload / Replace ---------- */
async function actionReadFile(prefilledPath = "") {
  if (!ensureRepo()) return;
  const path = prefilledPath || await promptInput({
    title: "Read File", label: "File path", placeholder: "e.g. README.md", confirm: "Read",
  });
  if (!path) return;
  try {
    showLoader("Reading file…");
    const data = await api(`/read-file?path=${encodeURIComponent(path)}`);
    const f = data.file;
    const display = f.is_binary
      ? `[binary file, ${f.size} bytes]\n\nBase64 (truncated):\n${f.content.slice(0, 4000)}${f.content.length > 4000 ? "\n…" : ""}`
      : f.content;
    setPanel(`File · ${f.path}`, `
      <div class="path-bar">
        <span>${escapeHtml(f.path)}</span>
        <span class="sep">·</span>
        <span>${formatSize(Math.round((f.size||0)/1024))}</span>
        <span class="sep">·</span>
        <span>sha ${f.sha.slice(0,7)}</span>
        ${f.html_url ? `<span class="sep">·</span><a href="${f.html_url}" target="_blank" rel="noopener">View on GitHub</a>` : ""}
      </div>
      <pre class="code-viewer">${escapeHtml(display)}</pre>
    `);
    toast("File loaded", "success");
  } catch (e) { toast(e.message, "error"); }
  finally { hideLoader(); }
}

async function actionReplaceFile(prefilledPath = "") {
  if (!ensureRepo()) return;
  let path = prefilledPath;
  if (!path) {
    path = await promptInput({ title: "Replace File", label: "File path", placeholder: "e.g. README.md", confirm: "Continue" });
    if (!path) return;
  }
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

/* ---------- Multi-file & folder upload (unified) ---------- */
function actionUploadFile() {
  if (!ensureRepo()) return;
  const picker = $("filePicker");
  picker.value = "";
  picker.onchange = (e) => handleFilesPicked(e, /* isFolder */ false);
  picker.click();
}

function actionUploadFolder() {
  if (!ensureRepo()) return;
  const picker = $("folderPicker");
  picker.value = "";
  picker.onchange = (e) => handleFilesPicked(e, /* isFolder */ true);
  picker.click();
}

function handleFilesPicked(e, isFolder) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  let rootFolder = "";
  let items;
  if (isFolder) {
    // ── FIXED: detect root folder from webkitRelativePath ──────────────────
    // webkitRelativePath = "myproject/src/file.js"
    // rootFolder = "myproject"
    // We KEEP the rootFolder in the path so the folder itself gets created in
    // the repo (not just its children).  The folder is placed under whatever
    // the user types in "Target directory".
    const firstRel = files[0].webkitRelativePath || files[0].name;
    rootFolder = firstRel.includes("/") ? firstRel.split("/")[0] : "";

    items = files.map(f => {
      let rel = f.webkitRelativePath || f.name;
      // Strip root folder name — upload only CONTENTS inside
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
          runFolderUpload(items, baseDir, msgPrefix);
      }},
    ],
  });
}

async function runFolderUpload(items, baseDir, msgPrefix) {
  const total = items.length;

  // Show progress panel
  setPanel(`Uploading · ${total} file(s) — preparing…`, `
    <div class="folder-summary">
      ${cell("Total files", total)}
      ${cell("Target", baseDir || "&lt;repo root&gt;")}
      ${cell("Status", `<span id="pgStatus">Reading files…</span>`)}
    </div>
    <div class="progress-shell"><div class="progress-fill" id="pgFill" style="width:0%"></div></div>
    <div id="pgLog" style="font-size:12px;color:var(--text-dim);margin-top:10px;max-height:300px;overflow-y:auto;padding:0 2px"></div>
  `);

  // ── Step 1: Read all files into base64 ───────────────────────────────────
  const filePayload = [];
  let readDone = 0;

  for (const it of items) {
    try {
      const content = await fileToBase64(it.file);
      filePayload.push({ path: it.rel, content });
    } catch (e) {
      // Should never fail, but log it
      const log = $("pgLog");
      if (log) log.innerHTML += `<div style="color:var(--danger)">✕ Read failed: ${escapeHtml(it.rel)}</div>`;
    }
    readDone++;
    $("pgFill").style.width = `${Math.round((readDone / total) * 50)}%`; // 0-50%
    $("pgStatus").textContent = `Reading files… ${readDone}/${total}`;
  }

  if (!filePayload.length) {
    toast("No files could be read", "error");
    return;
  }

  // ── Step 2: Send ALL files in ONE request (like git push) ────────────────
  $("pgStatus").textContent = `Pushing ${filePayload.length} files to GitHub…`;
  $("pgFill").style.width = "60%";

  const commitMsg = `${msgPrefix} (${filePayload.length} files)`;

  try {
    const data = await api("/upload-folder-atomic", {
      method: "POST",
      body: JSON.stringify({
        files:    filePayload,
        base_dir: baseDir,
        message:  commitMsg,
      }),
    });

    $("pgFill").style.width = "100%";
    $("pgStatus").innerHTML = `<span style="color:var(--success)">✓ Done — commit <b>${(data.commit||"").slice(0,7)}</b></span>`;

    // Show all files as uploaded
    const log = $("pgLog");
    if (log) {
      log.innerHTML = filePayload.map(f =>
        `<div><span style="color:var(--success)">✓</span> ${escapeHtml(f.path)}</div>`
      ).join("");
    }

    toast(`✓ Uploaded ${data.files_count} file(s) in 1 commit`, "success");
    refreshInfo({ silent: true }).catch(() => {});

  } catch (e) {
    $("pgFill").style.width = "100%";
    $("pgStatus").innerHTML = `<span style="color:var(--danger)">✕ Failed: ${escapeHtml(e.message)}</span>`;
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

/* ---------- Bulk / single delete (atomic) ---------- */
async function actionDeleteSelected(items) {
  if (!ensureRepo()) return;
  if (!items?.length) return;
  const hasDir = items.some(i => i.type === "dir");

  openModal({
    title: items.length === 1 ? "Delete" : `Delete ${items.length} items`,
    bodyHtml: `
      <p>You are about to delete the following:</p>
      <div class="del-list">
        ${items.map(i =>
          `<div class="del-row">
             <span>${escapeHtml(i.path)}</span>
             ${i.type === "dir" ? `<span class="badge warn">recursive</span>` : ""}
           </div>`
        ).join("")}
      </div>
      ${hasDir ? `<p class="muted" style="margin-top:8px">Folders will be deleted with all their contents (including nested folders).</p>` : ""}
      <div class="form-row" style="margin-top:14px">
        <label>Commit message</label>
        <input id="dMsg" value="GITPUSH: delete ${items.length} item(s)">
      </div>
      <p class="muted" style="margin:6px 0 0;font-size:11px">All deletions are bundled into a single atomic commit.</p>
    `,
    footer: [
      { label: "Cancel", onClick: (close) => close() },
      { label: `Delete ${items.length}`, className: "danger", onClick: async (close) => {
          const message = $("dMsg").value.trim() || `GITPUSH: delete ${items.length} item(s)`;
          try {
            showLoader("Deleting…");
            const data = await api("/delete-many", {
              method: "POST",
              body: JSON.stringify({
                paths: items.map(i => i.path),
                recursive: true,
                message,
              }),
            });
            close();
            toast(`Deleted ${data.count} file(s) (${data.commit?.slice(0,7)})`, "success");
            await actionListFiles(state.currentPath || "");
            refreshInfo({ silent: true }).catch(() => {});
          } catch (e) { toast(e.message, "error"); }
          finally { hideLoader(); }
      }},
    ],
  });
}

async function actionDeleteAll() {
  if (!ensureRepo()) return;
  openModal({
    title: "⚠ Delete All Files",
    bodyHtml: `
      <div class="danger-banner">
        <b>This will delete every file in <code>${FIXED_USERNAME}/${escapeHtml(state.repo)}</code></b><br>
        <span style="color:var(--text-dim);font-size:12px">
          Commit history is preserved. This cannot be undone from the UI.
        </span>
      </div>
      <div class="form-row" style="margin-top:14px">
        <label>Commit message</label>
        <input id="dMsg" value="GITPUSH: full repository cleanup">
      </div>
    `,
    footer: [
      { label: "Cancel", onClick: (close) => close() },
      { label: "Delete All", className: "danger", onClick: async (close) => {
          const message = $("dMsg").value.trim() || "GITPUSH: full repository cleanup";
          try {
            showLoader("Deleting all files…");
            const data = await api("/delete-all", {
              method: "POST",
              body: JSON.stringify({ confirm: "DELETE ALL", message }),
            });
            close();
            toast(`${data.message} (${data.commit?.slice(0,7)})`, "success");
            await actionListFiles("");
            refreshInfo({ silent: true }).catch(() => {});
          } catch (e) { toast(e.message, "error"); }
          finally { hideLoader(); }
      }},
    ],
  });
}
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
    `);
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
    const rows = data.commits.map((c, i) => `
      <div class="commit-item" style="animation-delay:${i * 25}ms">
        <a class="commit-sha" href="${c.html_url}" target="_blank" rel="noopener">${c.short_sha}</a>
        <div class="commit-msg">${escapeHtml(c.message)}</div>
        <div class="commit-meta">
          ${escapeHtml(c.author)}<br>
          ${c.date ? new Date(c.date).toLocaleString() : ""}
        </div>
      </div>
    `).join("") || `<div class="empty-state"><p>No commits found.</p></div>`;

    setPanel(`Git Status · ${data.branch}`, `
      <div class="path-bar">
        Branch <b style="color:var(--accent)">${escapeHtml(data.branch)}</b>
        <span class="sep">·</span>
        Showing latest <b>${data.count}</b> commits
      </div>
      <div class="commit-list">${rows}</div>
    `);
    toast("Git status loaded", "success");
  } catch (e) { toast(e.message, "error"); }
  finally { hideLoader(); }
}

async function actionRefresh() {
  if (state.repo) {
    await refreshInfo({ silent: false });
    await actionListFiles(state.currentPath || "");
  } else {
    toast("Nothing to refresh — pick a repo", "error");
  }
}

/* ---------- Generic prompt ---------- */
function promptInput({ title, label, placeholder, confirm = "OK", initial = "" }) {
  return new Promise(resolve => {
    openModal({
      title,
      bodyHtml: `
        <div class="form-row">
          <label>${label}</label>
          <input id="pIn" placeholder="${escapeAttr(placeholder)}" value="${escapeAttr(initial)}">
        </div>
      `,
      footer: [
        { label: "Cancel", onClick: (close) => { close(); resolve(null); } },
        { label: confirm, className: "primary", onClick: (close) => {
            const v = $("pIn").value.trim();
            close();
            resolve(v || null);
        }},
      ],
    });
    setTimeout(() => $("pIn").focus(), 50);
  });
}

/* ---------- Wiring ---------- */
document.querySelectorAll(".action-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const act = btn.dataset.action;
    if (act === "list")          actionListFiles(state.currentPath || "");
    if (act === "upload")        actionUploadFile();
    if (act === "upload-folder") actionUploadFolder();
    if (act === "replace")       actionReplaceFile();
    if (act === "delete")        actionDeleteSelected([]); // opens picker via empty list
    if (act === "read")          actionReadFile();
    if (act === "info")          actionRepoInfo();
    if (act === "status")        actionGitStatus();
    if (act === "change")        actionChangeRepo();
    if (act === "refresh")       actionRefresh();
  });
});

// "Delete File" toolbar button → ask for a path, then delete (single)
const _origDelete = actionDeleteSelected;
function deleteByPrompt() {
  return promptInput({
    title: "Delete File or Folder",
    label: "Path to delete",
    placeholder: "e.g. src/old.js or docs/",
    confirm: "Continue",
  }).then(p => p && _origDelete([{ path: p.replace(/\/+$/, ""), type: p.endsWith("/") ? "dir" : "file" }]));
}
// override: data-action=delete on top button asks for a path first
document.querySelector('.action-btn[data-action="delete"]')
  ?.addEventListener("click", (e) => { e.stopImmediatePropagation(); deleteByPrompt(); }, true);

/* ---------- Utils ---------- */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[m]);
}
function escapeAttr(s) { return escapeHtml(s); }

/* ---------- Boot ---------- */
loadInitialContext();
