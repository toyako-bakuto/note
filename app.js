// ============================================================
// STATE
// ============================================================
const state = {
  notes: [],
  selectedCategory: "ALL",
  understandingFilter: "ALL",
  sortBy: "default",
  editingIndex: null,
  colorStates: {
    understand: false,
    notUnderstand: false,
    commonMistakes: false,
  },
  editorDisplayMode: {
    understand: "rich",
    notUnderstand: "rich",
    commonMistakes: "rich",
  },
  editorContentStore: { understand: "", notUnderstand: "", commonMistakes: "" },
  latihanQuillIdCounter: 0,
  programQuillIdCounter: 0,
  breakfixQuillIdCounter: 0,
  currentNoteIndex: 0,
  isModalOpen: false,
};

// ============================================================
// SERVER API FUNCTIONS (PHP save-data)
// ============================================================
const API_URL = "save-data.php";

async function saveToServer(notes) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes: notes }),
    });

    const result = await response.json();
    if (result.success) {
      updateSyncStatus("💾 Tersimpan ke server");
      return true;
    } else {
      console.error("Server error:", result.message);
      updateSyncStatus("⚠️ Gagal simpan ke server");
      return false;
    }
  } catch (error) {
    console.error("Network error:", error);
    updateSyncStatus("⚠️ Gagal koneksi ke server");
    return false;
  }
}

async function loadFromServer() {
  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error loading from server:", error);
    updateSyncStatus("⚠️ Gagal ambil dari server");
    return null;
  }
}

async function resetServerData() {
  try {
    const response = await fetch(API_URL, {
      method: "DELETE",
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error("Error resetting server data:", error);
    return false;
  }
}

// ============================================================
// MODIFIED STORAGE FUNCTIONS
// ============================================================
async function saveToStorage() {
  try {
    localStorage.setItem("notes_minimal", JSON.stringify(state.notes));
    await saveToServer(state.notes);
    updateSyncStatus("💾 Tersimpan");
    return true;
  } catch (e) {
    console.error("Save error:", e);
    return false;
  }
}

async function loadFromStorage() {
  try {
    const localData = localStorage.getItem("notes_minimal");
    let hasLocalData = false;
    let parsedData = null;

    if (localData) {
      try {
        parsedData = JSON.parse(localData);
        if (Array.isArray(parsedData) && parsedData.length) {
          hasLocalData = true;
        }
      } catch (e) {}
    }

    const serverData = await loadFromServer();

    if (serverData && Array.isArray(serverData) && serverData.length) {
      state.notes = serverData.map((n, i) => ({ ...n, id: i }));
      localStorage.setItem("notes_minimal", JSON.stringify(state.notes));
      updateSyncStatus("💾 Load dari server");
      return true;
    } else if (hasLocalData && parsedData) {
      state.notes = parsedData.map((n, i) => ({ ...n, id: i }));
      await saveToServer(state.notes);
      updateSyncStatus("💾 Load dari lokal & sync ke server");
      return true;
    }

    return false;
  } catch (e) {
    console.error("Load error:", e);
    return false;
  }
}

// ============================================================
// UTILITIES
// ============================================================
function escapeHTML(str) {
  if (!str) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function showToast(msg, isError = false) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast ${isError ? "error" : ""}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function getFileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  const map = {
    html: "🌐",
    css: "🎨",
    js: "📜",
    py: "🐍",
    php: "🐘",
    java: "☕",
    cpp: "⚙️",
    go: "🐹",
    rs: "🦀",
    rb: "💎",
    sql: "🗄️",
    md: "📝",
    txt: "📄",
    vue: "🟢",
    ts: "📘",
    jsx: "⚛️",
    json: "📋",
  };
  return map[ext] || "📄";
}

function updateSyncStatus(msg) {
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = msg;
}

function getFilteredNotes() {
  const keyword =
    document.getElementById("searchInput")?.value?.toLowerCase().trim() || "";
  const cat = state.selectedCategory;
  const und = state.understandingFilter;
  return state.notes.filter((n) => {
    if (cat !== "ALL" && (n.category || "Umum") !== cat) return false;
    if (und !== "ALL" && n.understanding !== und) return false;
    if (keyword) {
      const searchable =
        (n.title || "") +
        stripHtml(n.understand || "") +
        stripHtml(n.notUnderstand || "") +
        stripHtml(n.commonMistakes || "") +
        (n.syntaxCode || "");
      if (!searchable.toLowerCase().includes(keyword)) return false;
    }
    return true;
  });
}

function sortNotes(arr) {
  if (state.sortBy === "newest")
    return [...arr].sort((a, b) => new Date(b.created) - new Date(a.created));
  if (state.sortBy === "oldest")
    return [...arr].sort((a, b) => new Date(a.created) - new Date(b.created));
  if (state.sortBy === "title")
    return [...arr].sort((a, b) =>
      (a.title || "").localeCompare(b.title || ""),
    );
  return [...arr].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
}

// ============================================================
// AUTO-EXPAND TEXTAREA
// ============================================================
function autoExpandTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

function setupAutoExpand(selector) {
  document.addEventListener("input", function (e) {
    if (e.target.matches(selector)) {
      autoExpandTextarea(e.target);
    }
  });

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "childList") {
        document.querySelectorAll(selector).forEach(function (textarea) {
          if (!textarea.dataset.autoExpandSetup) {
            textarea.dataset.autoExpandSetup = "true";
            autoExpandTextarea(textarea);
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  document.querySelectorAll(selector).forEach(function (textarea) {
    textarea.dataset.autoExpandSetup = "true";
    autoExpandTextarea(textarea);
  });
}

// ============================================================
// NAVIGATION - WITH TWO NAV BARS - FIXED
// ============================================================
function navigateToNote(index) {
  const filtered = sortNotes(getFilteredNotes());
  if (!filtered.length) {
    state.currentNoteIndex = 0;
    renderSingleNote(null);
    updateNavButtons(0, 0);
    return;
  }
  if (index < 0) index = 0;
  if (index >= filtered.length) index = filtered.length - 1;
  state.currentNoteIndex = index;
  renderSingleNote(filtered[index]);
  updateNavButtons(index, filtered.length);
}

function updateNavButtons(currentIndex, total) {
  // Tombol navigasi atas
  const prevBtnTop = document.getElementById("prevNoteNavTop");
  const nextBtnTop = document.getElementById("nextNoteNavTop");
  const pageInputTop = document.getElementById("pageInputTop");
  const pageTotalTop = document.getElementById("pageTotalTop");
  
  // Tombol navigasi bawah
  const prevBtnBottom = document.getElementById("prevNoteNavBottom");
  const nextBtnBottom = document.getElementById("nextNoteNavBottom");
  const pageInputBottom = document.getElementById("pageInputBottom");
  const pageTotalBottom = document.getElementById("pageTotalBottom");
  
  // Update semua tombol navigasi
  const updateButtons = (prevBtn, nextBtn) => {
    if (prevBtn) {
      prevBtn.disabled = total === 0 || currentIndex <= 0;
    }
    if (nextBtn) {
      nextBtn.disabled = total === 0 || currentIndex >= total - 1;
    }
  };
  
  updateButtons(prevBtnTop, nextBtnTop);
  updateButtons(prevBtnBottom, nextBtnBottom);
  
  // Update semua page input
  const updatePageInput = (input, totalEl) => {
    if (input) {
      input.value = total > 0 ? currentIndex + 1 : 0;
      input.max = total > 0 ? total : 1;
      input.min = 1;
    }
    if (totalEl) {
      totalEl.textContent = `/ ${total}`;
    }
  };
  
  updatePageInput(pageInputTop, pageTotalTop);
  updatePageInput(pageInputBottom, pageTotalBottom);
  
  // Update total notes
  const totalNotesEl = document.getElementById("totalNotes");
  if (totalNotesEl) {
    totalNotesEl.textContent = `${total} catatan`;
  }
}

function goPrevNote() {
  if (state.isModalOpen) return;
  const filtered = sortNotes(getFilteredNotes());
  if (!filtered.length) return;
  if (state.currentNoteIndex > 0) {
    navigateToNote(state.currentNoteIndex - 1);
  }
}

function goNextNote() {
  if (state.isModalOpen) return;
  const filtered = sortNotes(getFilteredNotes());
  if (!filtered.length) return;
  if (state.currentNoteIndex < filtered.length - 1) {
    navigateToNote(state.currentNoteIndex + 1);
  }
}

function goToPageNumber(inputId = 'pageInputTop') {
  const pageInput = document.getElementById(inputId);
  if (!pageInput) return;
  
  const filtered = sortNotes(getFilteredNotes());
  const total = filtered.length;
  
  if (total === 0) {
    pageInput.value = 0;
    // Update both inputs
    const otherInput = inputId === 'pageInputTop' ? 'pageInputBottom' : 'pageInputTop';
    const other = document.getElementById(otherInput);
    if (other) other.value = 0;
    return;
  }
  
  let pageNumber = parseInt(pageInput.value);
  
  if (isNaN(pageNumber) || pageNumber < 1) {
    pageNumber = 1;
  }
  if (pageNumber > total) {
    pageNumber = total;
  }
  
  pageInput.value = pageNumber;
  
  // Sync both inputs
  const otherInput = inputId === 'pageInputTop' ? 'pageInputBottom' : 'pageInputTop';
  const other = document.getElementById(otherInput);
  if (other) other.value = pageNumber;
  
  const index = pageNumber - 1;
  navigateToNote(index);
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener("keydown", (e) => {
  if (state.isModalOpen) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeEditModal();
    }
    return;
  }

  const target = e.target;
  
  if (target.tagName === "INPUT" || 
      target.tagName === "TEXTAREA" || 
      target.tagName === "SELECT") {
    if (target.id === "pageInputTop" || target.id === "pageInputBottom") return;
    return;
  }

  switch (e.key) {
    case "ArrowLeft":
      e.preventDefault();
      goPrevNote();
      break;
    case "ArrowRight":
      e.preventDefault();
      goNextNote();
      break;
    case "e":
    case "E":
      e.preventDefault();
      handleEditShortcut();
      break;
    case "t":
    case "T":
      e.preventDefault();
      openEditModal(null, null);
      showToast("📝 Tekan T untuk tambah catatan");
      break;
    case "i":
    case "I":
      e.preventDefault();
      handleImportShortcut();
      break;
    case "x":
    case "X":
      e.preventDefault();
      handleExportShortcut();
      break;
  }
});

// ============================================================
// DOUBLE CLICK TO ADD NOTE
// ============================================================
document.addEventListener("dblclick", function(e) {
  if (!e.target.closest('.note-card') && 
      !e.target.closest('.modal-overlay') && 
      !e.target.closest('.modal-box') &&
      !e.target.closest('.filters-bar') &&
      !e.target.closest('.nav-bar') &&
      !e.target.closest('.shortcut-footer')) {
    // if (!state.isModalOpen) {
    //   openEditModal(null, null);
    //   showToast("📝 Double-click untuk tambah catatan");
    // }
  }
});

// ============================================================
// SHORTCUT HANDLERS
// ============================================================
function handleEditShortcut() {
  const filtered = sortNotes(getFilteredNotes());
  if (filtered.length > 0 && filtered[state.currentNoteIndex]) {
    const currentNote = filtered[state.currentNoteIndex];
    const originalNote = state.notes.find(n => n.id === currentNote.id);
    if (originalNote) {
      openEditModal(originalNote, originalNote.id);
      showToast("✏️ Edit catatan");
    }
  } else {
    showToast("📝 Tidak ada catatan untuk diedit", true);
  }
}

function handleImportShortcut() {
  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.click();
    showToast("📥 Pilih file untuk import");
  } else {
    showToast("⚠️ File input tidak ditemukan", true);
  }
}

function handleExportShortcut() {
  if (state.notes.length === 0) {
    showToast("⚠️ Tidak ada catatan untuk diekspor", true);
    return;
  }
  exportNotes();
}

// ============================================================
// EVENT LISTENER FOR PAGE NUMBER INPUTS
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // Event listener untuk pageInputTop
    const pageInputTop = document.getElementById('pageInputTop');
    if (pageInputTop) {
        pageInputTop.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                goToPageNumber('pageInputTop');
            }
        });
        
        pageInputTop.addEventListener('blur', function() {
            goToPageNumber('pageInputTop');
        });
        
        pageInputTop.addEventListener('change', function() {
            goToPageNumber('pageInputTop');
        });
    }
    
    // Event listener untuk pageInputBottom
    const pageInputBottom = document.getElementById('pageInputBottom');
    if (pageInputBottom) {
        pageInputBottom.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                goToPageNumber('pageInputBottom');
            }
        });
        
        pageInputBottom.addEventListener('blur', function() {
            goToPageNumber('pageInputBottom');
        });
        
        pageInputBottom.addEventListener('change', function() {
            goToPageNumber('pageInputBottom');
        });
    }
});

// ============================================================
// RENDER SINGLE NOTE - FIXED (all descriptions use ql-editor)
// ============================================================
function renderSingleNote(note) {
  const container = document.getElementById("noteDisplay");
  if (!note) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>📭 Belum ada catatan</h3>
        <p>Mulai dengan menekan <kbd>T</kbd> atau double-click di area kosong</p>
        <div class="shortcut-empty">
          <kbd>T</kbd> Tambah · <kbd>E</kbd> Edit · <kbd>←</kbd> <kbd>→</kbd> Navigasi
        </div>
      </div>
    `;
    return;
  }

  const n = note;
  const cat = n.category || "Umum";
  const status = n.understanding === "paham" ? "✅ Paham" : "❌ Belum";
  const type =
    n.fundamentalType === "fundamental"
      ? "⭐ Fundamental"
      : "📘 Non-Fundamental";
  const pin = n.pin ? "📌" : "";
  const fav = n.favorite ? "⭐" : "";

  // ===== FUNCTION TO RENDER RESULT =====
  function renderResult(resultData) {
    if (!resultData) return "";
    let html = "";
    if (resultData.imageData && resultData.imageData.length > 0) {
      html = `<div style="margin:6px 0;border-radius:8px;overflow:hidden;border:1px solid var(--border);background:var(--bg);">
        <img src="${resultData.imageData}" style="max-width:100%;display:block;object-fit:contain;" />
      </div>`;
    } else if (resultData.textResult && resultData.textResult.length > 0) {
      html = `<div class="code-block" style="margin:6px 0;background:#181818;color:#f0f0ee;padding:10px 14px;border-radius:8px;font-family:monospace;font-size:0.75rem;white-space:pre-wrap;word-break:break-all;">${escapeHTML(resultData.textResult)}</div>`;
    }
    if (resultData.description && resultData.description.length > 0) {
      html = `<div class="text-sm" style="margin-bottom:4px;color:var(--muted);">${resultData.description}</div>` + html;
    }
    return html ? `<div style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px;"><span class="text-sm" style="font-weight:600;color:var(--muted);">📊 Hasil:</span>${html}</div>` : "";
  }

  // ===== LATIHAN - GITHUB STYLE =====
  let latihanHtml = "";
  if (n.latihans && n.latihans.length) {
    latihanHtml = n.latihans
      .map((l, li) => {
        // Generate file links as GitHub-style buttons
        const filesHtml = (l.files || [])
          .map((f) => {
            // If file has a URL (github link), render as button
            if (f.url) {
              return `
                <a href="${escapeHTML(f.url)}" target="_blank" rel="noopener noreferrer" class="btn-github">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  ${escapeHTML(f.name)}
                </a>
              `;
            }
            // Fallback: show as file with content if no URL
            if (f.content) {
              return `
                <span class="latihan-file-link">
                  ${getFileIcon(f.name)} ${escapeHTML(f.name)}
                </span>
              `;
            }
            // Minimal display
            return `
              <span class="latihan-file-link">
                ${getFileIcon(f.name)} ${escapeHTML(f.name)}
              </span>
            `;
          })
          .join("");
        
        // Build result HTML
        const resultHtml = renderResult(l.result);
        
        return `
          <div class="sub-item">
            <div class="latihan-header">
              <span class="latihan-title-link">
                🏋️ ${escapeHTML(l.title || "Latihan")}
                ${l.link ? `<a href="${escapeHTML(l.link)}" target="_blank" rel="noopener noreferrer" style="font-size:0.7rem;color:var(--muted);margin-left:4px;">🔗</a>` : ''}
              </span>
              <span class="sub-item-meta">${(l.files || []).length} file</span>
            </div>
            
            ${l.description ? `<div class="latihan-description"><div class="ql-editor" style="padding:0;">${l.description}</div></div>` : ""}
            
            ${filesHtml ? `<div class="latihan-files-github">${filesHtml}</div>` : ""}
            
            ${resultHtml ? `<div class="latihan-result-display"><span class="result-label">📊 Hasil</span>${resultHtml}</div>` : ""}
          </div>
        `;
      })
      .join("");
  }

  // ===== BREAK & FIX =====
  let breakfixHtml = "";
  if (n.breakfixs && n.breakfixs.length) {
    breakfixHtml = n.breakfixs
      .map((b, bi) => {
        const resultHtml = renderResult(b.result);
        
        return `
          <div class="sub-item">
            <div class="sub-item-header">
              <span class="sub-item-title">🐛 ${escapeHTML(b.title || "Break & Fix")}</span>
              <span class="sub-item-meta">${b.solved ? "✅ Solved" : "⏳ In Progress"}</span>
            </div>
            ${b.description ? `<div class="text-sm"><div class="ql-editor" style="padding:0;">${b.description}</div></div>` : ""}
            <div class="breakfix-row">
              ${b.brokenCode ? `<div><span class="text-sm">🔴 Broken</span><div class="code-block broken">${escapeHTML(b.brokenCode)}</div></div>` : ""}
              ${b.fixedCode ? `<div><span class="text-sm">🟢 Fixed</span><div class="code-block fixed">${escapeHTML(b.fixedCode)}</div></div>` : ""}
            </div>
            ${b.hint ? `<div class="text-sm"><div class="ql-editor" style="padding:0;">${b.hint}</div></div>` : ""}
            ${resultHtml}
            <button class="btn btn-sm btn-outline" onclick="showDiff(${n.id},${bi})">🔍 Diff</button>
          </div>
        `;
      })
      .join("");
  }

  // ===== PROGRAM =====
  let programHtml = "";
  if (n.programs && n.programs.length) {
    programHtml = n.programs
      .map((p, pi) => {
        const resultHtml = renderResult(p.result);
        
        return `
          <div class="sub-item">
            <div class="sub-item-header">
              <span class="sub-item-title">💻 ${escapeHTML(p.title || "Program")}</span>
            </div>
            ${p.description ? `<div class="text-sm"><div class="ql-editor" style="padding:0;">${p.description}</div></div>` : ""}
            ${p.code ? `<div class="code-block">${escapeHTML(p.code)}</div>` : ""}
            ${resultHtml}
          </div>
        `;
      })
      .join("");
  }

  const syntaxHtml = n.syntaxCode
    ? `<div class="code-block">${escapeHTML(n.syntaxCode)}</div>`
    : "";

  const html = `
    <div class="note-card" id="note-${n.id}">
      <div class="note-header">
        <div>
          <div class="note-title">${pin} ${fav} ${escapeHTML(n.title || "Tanpa Judul")}</div>
          <div class="note-tags">
            <span class="tag">${escapeHTML(cat)}</span>
            <span class="tag ${n.understanding === "paham" ? "tag-paham" : "tag-belum"}">${status}</span>
            <span class="tag ${n.fundamentalType === "fundamental" ? "tag-fundamental" : "tag-nonfundamental"}">${type}</span>
          </div>
        </div>
      </div>

      <div class="note-body">
        ${n.understand ? `<div class="block full"><span class="block-label">✅ Dipahami</span><div class="block-content"><div class="ql-editor" style="padding:0;">${n.understand}</div></div></div>` : ""}
        ${n.notUnderstand ? `<div class="block full"><span class="block-label">❌ Belum dipahami</span><div class="block-content"><div class="ql-editor" style="padding:0;">${n.notUnderstand}</div></div></div>` : ""}
        ${n.commonMistakes ? `<div class="block full"><span class="block-label">⚠️ Kesalahan Umum</span><div class="block-content"><div class="ql-editor" style="padding:0;">${n.commonMistakes}</div></div></div>` : ""}
        ${syntaxHtml ? `<div class="block full"><span class="block-label">📝 Syntax</span>${syntaxHtml}</div>` : ""}
      </div>

      ${latihanHtml ? `<div class="sub-section"><span class="sub-section-title">🏋️ Latihan</span>${latihanHtml}</div>` : ""}
      ${breakfixHtml ? `<div class="sub-section"><span class="sub-section-title">🐛 Break & Fix</span>${breakfixHtml}</div>` : ""}
      ${programHtml ? `<div class="sub-section"><span class="sub-section-title">💻 Program</span>${programHtml}</div>` : ""}

      <div class="note-actions">
        <button class="btn btn-sm btn-outline" onclick="togglePin(${n.id})">${n.pin ? "📌 Unpin" : "📍 Pin"}</button>
        <button class="btn btn-sm btn-outline" onclick="toggleFavorite(${n.id})">${n.favorite ? "⭐ Unfavorite" : "☆ Favorite"}</button>
        <button class="btn btn-sm" onclick="editNote(${n.id})">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteNote(${n.id})">🗑️</button>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

function updateCategoryDropdown() {
  const sel = document.getElementById("categorySelect");
  if (!sel) return;
  const cats = new Set(state.notes.map((n) => n.category || "Umum"));
  let html = '<option value="ALL">Semua Kategori</option>';
  cats.forEach((c) => (html += `<option value="${c}">${c}</option>`));
  sel.innerHTML = html;
  sel.value = state.selectedCategory;
}

// ============================================================
// WRAPPER RENDER - FIXED
// ============================================================
function render() {
  const filtered = sortNotes(getFilteredNotes());
  const total = filtered.length;
  
  if (total === 0) {
    state.currentNoteIndex = 0;
    renderSingleNote(null);
    updateNavButtons(0, 0);
  } else {
    if (state.currentNoteIndex >= total) state.currentNoteIndex = total - 1;
    if (state.currentNoteIndex < 0) state.currentNoteIndex = 0;
    renderSingleNote(filtered[state.currentNoteIndex]);
    updateNavButtons(state.currentNoteIndex, total);
  }
  
  updateCategoryDropdown();
  
  // Update total notes
  const totalNotesEl = document.getElementById("totalNotes");
  if (totalNotesEl) {
    totalNotesEl.textContent = `${total} catatan`;
  }
}

// ============================================================
// MODAL CONTROL
// ============================================================
function openModal() {
  state.isModalOpen = true;
  document.body.classList.add("modal-open");
  const modal = document.getElementById("editModal");
  if (modal) modal.classList.remove("hidden");
}

function closeModal() {
  state.isModalOpen = false;
  document.body.classList.remove("modal-open");
  const modal = document.getElementById("editModal");
  if (modal) modal.classList.add("hidden");
}

// ============================================================
// DIFF
// ============================================================
function showDiff(noteIdx, breakfixIdx) {
  const note = state.notes.find((n) => n.id === noteIdx);
  if (!note || !note.breakfixs || !note.breakfixs[breakfixIdx]) return;
  const b = note.breakfixs[breakfixIdx];
  const broken = (b.brokenCode || "").split("\n");
  const fixed = (b.fixedCode || "").split("\n");
  const maxLen = Math.max(broken.length, fixed.length);

  let rows = "";
  for (let i = 0; i < maxLen; i++) {
    const br = broken[i] || "";
    const fi = fixed[i] || "";
    const diff = br !== fi;
    rows += `<tr class="${diff ? "diff-different" : ""}">
                        <td class="diff-line-num">${i + 1}</td>
                        <td class="${!br && fi ? "diff-removed" : ""}">${escapeHTML(br) || "&nbsp;"}</td>
                        <td class="diff-line-num">${i + 1}</td>
                        <td class="${br && !fi ? "diff-added" : ""}">${escapeHTML(fi) || "&nbsp;"}</td>
                    </tr>`;
  }

  const diffBody = document.getElementById("diffBody");
  if (diffBody) {
    diffBody.innerHTML = `
                    <table class="diff-table">
                        <thead><tr><th>#</th><th>🔴 Broken</th><th>#</th><th>🟢 Fixed</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="diff-legend">
                        <span>🟡 Berubah</span>
                        <span>🟢 Ditambahkan</span>
                        <span>🔴 Dihapus</span>
                    </div>
                    ${b.hint ? `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;"><strong>💡 Hint:</strong> <div class="ql-editor" style="padding:0;">${b.hint}</div></div>` : ""}
                    ${b.solution ? `<div><strong>✅ Solusi:</strong> <div class="ql-editor" style="padding:0;">${b.solution}</div></div>` : ""}
                `;
  }
  
  const diffModal = document.getElementById("diffModal");
  if (diffModal) diffModal.classList.remove("hidden");
}

const closeDiffBtn = document.getElementById("closeDiffBtn");
if (closeDiffBtn) {
  closeDiffBtn.addEventListener("click", () => {
    const diffModal = document.getElementById("diffModal");
    if (diffModal) diffModal.classList.add("hidden");
  });
}

const diffModal = document.getElementById("diffModal");
if (diffModal) {
  diffModal.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      diffModal.classList.add("hidden");
    }
  });
}

// ============================================================
// TOGGLES
// ============================================================
window.togglePin = async function (id) {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return;
  note.pin = !note.pin;
  await saveToStorage();
  render();
  showToast(note.pin ? "📌 Disematkan" : "📍 Sematan dicabut");
};
window.toggleFavorite = async function (id) {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return;
  note.favorite = !note.favorite;
  await saveToStorage();
  render();
  showToast(note.favorite ? "⭐ Favorit" : "☆ Bukan favorit");
};
window.deleteNote = async function (id) {
  if (!confirm("Hapus catatan ini?")) return;
  const idx = state.notes.findIndex((n) => n.id === id);
  if (idx === -1) return;
  state.notes.splice(idx, 1);
  state.notes.forEach((n, i) => (n.id = i));
  await saveToStorage();
  render();
  showToast("Catatan dihapus");
};

// ============================================================
// EDIT MODAL
// ============================================================
function openEditModal(noteData = null, editId = null) {
  state.editingIndex = editId;
  const modalTitle = document.getElementById("modalTitle");
  if (modalTitle) {
    modalTitle.textContent = editId !== null ? "✏️ Edit Catatan" : "📝 Tambah Catatan";
  }

  openModal();

  if (noteData) {
    const titleEl = document.getElementById("noteTitle");
    if (titleEl) titleEl.value = noteData.title || "";
    
    const categoryEl = document.getElementById("noteCategory");
    if (categoryEl) categoryEl.value = noteData.category || "Umum";
    
    document.querySelectorAll('input[name="understanding"]').forEach((r) => {
      r.checked = r.value === (noteData.understanding || "belum");
    });
    
    document.querySelectorAll('input[name="fundamentalType"]').forEach((r) => {
      r.checked = r.value === (noteData.fundamentalType || "nonfundamental");
    });
    
    const syntaxEl = document.getElementById("noteSyntaxCode");
    if (syntaxEl) syntaxEl.value = noteData.syntaxCode || "";
    
    setQuillContent("quillUnderstand", "understand", noteData.understand || "");
    setQuillContent("quillNotUnderstand", "notUnderstand", noteData.notUnderstand || "");
    setQuillContent("quillCommonMistakes", "commonMistakes", noteData.commonMistakes || "");
    setLatihans(noteData.latihans || []);
    setBreakfixs(noteData.breakfixs || []);
    setPrograms(noteData.programs || []);
  } else {
    const titleEl = document.getElementById("noteTitle");
    if (titleEl) titleEl.value = "";
    
    const categoryEl = document.getElementById("noteCategory");
    if (categoryEl) categoryEl.value = "Umum";
    
    document.querySelectorAll('input[name="understanding"]').forEach((r) => {
      r.checked = r.value === "belum";
    });
    
    document.querySelectorAll('input[name="fundamentalType"]').forEach((r) => {
      r.checked = r.value === "nonfundamental";
    });
    
    const syntaxEl = document.getElementById("noteSyntaxCode");
    if (syntaxEl) syntaxEl.value = "";
    
    setQuillContent("quillUnderstand", "understand", "");
    setQuillContent("quillNotUnderstand", "notUnderstand", "");
    setQuillContent("quillCommonMistakes", "commonMistakes", "");
    setLatihans([]);
    setBreakfixs([]);
    setPrograms([]);
  }

  setTimeout(function () {
    document
      .querySelectorAll(
        ".latihan-file-row textarea.file-content, .prog-code, .bf-broken, .bf-fixed",
      )
      .forEach(function (textarea) {
        if (!textarea.dataset.autoExpandSetup) {
          textarea.dataset.autoExpandSetup = "true";
          autoExpandTextarea(textarea);
        }
      });
  }, 100);
}

function closeEditModal() {
  closeModal();
}

window.editNote = function (id) {
  const note = state.notes.find((n) => n.id === id);
  if (note) openEditModal(note, id);
};

const cancelEdit = document.getElementById("cancelEdit");
if (cancelEdit) cancelEdit.addEventListener("click", closeEditModal);

const cancelEditBottom = document.getElementById("cancelEditBottom");
if (cancelEditBottom) cancelEditBottom.addEventListener("click", closeEditModal);

// ============================================================
// QUILL
// ============================================================
function initQuill(id, modeKey) {
  if (document.getElementById(id)) {
    const quill = new Quill(`#${id}`, {
      theme: "snow",
      placeholder: "Tulis di sini...",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ["bold", "italic", "underline", "strike"],
          ["blockquote", "code-block"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ color: [] }, { background: [] }],
          ["link", "image", "video"],
          ["clean"],
        ],
      },
    });
    quill.on("text-change", () => {
      if (state.editorDisplayMode[modeKey] === "rich") {
        state.editorContentStore[modeKey] = quill.root.innerHTML;
      }
    });
    window[id] = quill;
    return quill;
  }
  return null;
}

function setQuillContent(id, modeKey, content) {
  state.editorDisplayMode[modeKey] = "rich";
  const btn = document.getElementById(
    `toggleCode${modeKey.charAt(0).toUpperCase() + modeKey.slice(1)}`,
  );
  if (btn) {
    btn.classList.remove("active");
    btn.textContent = "📄 Kode";
  }
  const quill = window[id];
  if (quill) {
    quill.enable();
    quill.root.innerHTML = content || "";
    state.editorContentStore[modeKey] = content || "";
  }
}

function getQuillContent(id, modeKey) {
  const quill = window[id];
  if (!quill) return "";
  if (state.editorDisplayMode[modeKey] === "plain") {
    return quill.getText();
  }
  return quill.root.innerHTML;
}

// ============================================================
// COLOR & CODE TOGGLES
// ============================================================
function initToggles() {
  const toggles = [
    {
      id: "toggleColorUnderstand",
      quillId: "quillUnderstand",
      key: "understand",
    },
    {
      id: "toggleColorNotUnderstand",
      quillId: "quillNotUnderstand",
      key: "notUnderstand",
    },
    {
      id: "toggleColorCommonMistakes",
      quillId: "quillCommonMistakes",
      key: "commonMistakes",
    },
  ];
  toggles.forEach(({ id, quillId, key }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const quill = window[quillId];
      if (!quill) {
        showToast("Editor belum siap", true);
        return;
      }
      state.colorStates[key] = !state.colorStates[key];
      const isRed = state.colorStates[key];
      btn.textContent = isRed ? "🔴 Merah" : "⚫ Hitam";
      const color = isRed ? "#ef4444" : "#000000";
      const range = quill.getSelection();
      if (range && range.length > 0) {
        quill.format("color", color);
      } else {
        quill.format("color", color);
      }
      quill.focus();
    });
  });

  const codeToggles = [
    {
      id: "toggleCodeUnderstand",
      quillId: "quillUnderstand",
      key: "understand",
    },
    {
      id: "toggleCodeNotUnderstand",
      quillId: "quillNotUnderstand",
      key: "notUnderstand",
    },
    {
      id: "toggleCodeCommonMistakes",
      quillId: "quillCommonMistakes",
      key: "commonMistakes",
    },
  ];
  codeToggles.forEach(({ id, quillId, key }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const quill = window[quillId];
      if (!quill) {
        showToast("Editor belum siap", true);
        return;
      }
      if (state.editorDisplayMode[key] === "rich") {
        state.editorDisplayMode[key] = "plain";
        btn.textContent = "📄 Rich";
        state.editorContentStore[key] = quill.root.innerHTML;
        const plainText = quill.getText();
        quill.disable();
        quill.root.innerHTML = `<pre style="white-space:pre-wrap;font-family:monospace;font-size:.8rem;margin:0;padding:4px;background:transparent;">${escapeHTML(plainText)}</pre>`;
        showToast("📄 Mode teks");
      } else {
        state.editorDisplayMode[key] = "rich";
        btn.textContent = "📄 Kode";
        quill.enable();
        quill.root.innerHTML = state.editorContentStore[key] || "";
        showToast("✏️ Mode rich");
      }
    });
  });
}

// ============================================================
// EXPORT FUNCTION
// ============================================================
function exportNotes() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(state.notes, null, 2)]),
  );
  a.download = `catatan-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast("📤 Ekspor berhasil");
}

// ============================================================
// HASIL PROGRAM - REUSABLE FUNCTIONS
// ============================================================

function getResultFromSection(section) {
  if (!section) return null;
  const imageData = section.querySelector('.result-image-data')?.value || '';
  const textResult = section.querySelector('.result-text-content')?.value || '';
  const quillId = section.querySelector('[id^="resultDesc_"]')?.id || '';
  let description = '';
  if (quillId && window[quillId]) {
    description = window[quillId].root.innerHTML;
  }
  
  const imageSection = section.querySelector('.result-image-section');
  const isImageVisible = imageSection && imageSection.style.display !== 'none';
  
  let type = "none";
  if (isImageVisible && imageData) type = "image";
  else if (textResult) type = "text";
  
  if (imageData || textResult) {
    return {
      description: description.trim(),
      imageData: imageData,
      textResult: textResult,
      type: type
    };
  }
  return null;
}

function toggleResultTypeInSection(btn, type) {
  const section = btn.closest('.latihan-result-section, .breakfix-result-section, .program-result-section');
  if (!section) return;
  
  const imageSection = section.querySelector('.result-image-section');
  const textSection = section.querySelector('.result-text-section');
  
  const buttons = section.querySelectorAll('.btn-outline');
  buttons.forEach(b => {
    if (b.textContent.includes('Gambar') || b.textContent.includes('Text')) {
      b.className = 'btn btn-sm btn-outline';
    }
  });
  btn.className = 'btn btn-sm btn';
  
  if (type === 'image') {
    if (imageSection) imageSection.style.display = 'block';
    if (textSection) textSection.style.display = 'none';
  } else {
    if (imageSection) imageSection.style.display = 'none';
    if (textSection) textSection.style.display = 'block';
  }
}

function uploadResultImageInSection(btn) {
  const section = btn.closest('.latihan-result-section, .breakfix-result-section, .program-result-section');
  const input = section.querySelector('.result-image-input');
  if (input) input.click();
}

function handleResultImageUploadInSection(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (file.size > 2 * 1024 * 1024) {
    showToast("⚠️ Ukuran gambar maksimal 2MB", true);
    input.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const section = input.closest('.latihan-result-section, .breakfix-result-section, .program-result-section');
    if (!section) return;
    
    const preview = section.querySelector('.result-image-preview');
    const hidden = section.querySelector('.result-image-data');
    const removeBtn = section.querySelector('.btn-danger');
    
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border);" />`;
    }
    if (hidden) {
      hidden.value = e.target.result;
    }
    if (removeBtn) {
      removeBtn.style.display = 'inline-flex';
    }
    
    const imageSection = section.querySelector('.result-image-section');
    const textSection = section.querySelector('.result-text-section');
    if (imageSection) imageSection.style.display = 'block';
    if (textSection) textSection.style.display = 'none';
    
    const buttons = section.querySelectorAll('.btn-outline');
    buttons.forEach(b => {
      if (b.textContent.includes('Gambar')) {
        b.className = 'btn btn-sm btn';
      } else if (b.textContent.includes('Text')) {
        b.className = 'btn btn-sm btn-outline';
      }
    });
    
    showToast("🖼️ Gambar berhasil diupload");
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function removeResultImageInSection(btn) {
  const section = btn.closest('.latihan-result-section, .breakfix-result-section, .program-result-section');
  if (!section) return;
  
  const preview = section.querySelector('.result-image-preview');
  const hidden = section.querySelector('.result-image-data');
  
  if (preview) preview.innerHTML = '';
  if (hidden) hidden.value = '';
  btn.style.display = 'none';
  
  const imageSection = section.querySelector('.result-image-section');
  const textSection = section.querySelector('.result-text-section');
  if (imageSection) imageSection.style.display = 'none';
  if (textSection) textSection.style.display = 'block';
  
  const buttons = section.querySelectorAll('.btn-outline');
  buttons.forEach(b => {
    if (b.textContent.includes('Gambar')) {
      b.className = 'btn btn-sm btn-outline';
    } else if (b.textContent.includes('Text')) {
      b.className = 'btn btn-sm btn';
    }
  });
  
  showToast("🗑️ Gambar dihapus");
}

// ============================================================
// LATIHAN (modal form)
// ============================================================
function addLatihanToForm(data = null) {
  const list = document.getElementById("latihanList");
  if (!list) return;
  const idx = list.children.length;
  const id = "latihanDesc_" + Date.now() + "_" + state.latihanQuillIdCounter++;
  const resultId = "latihanResult_" + Date.now() + "_" + state.latihanQuillIdCounter++;
  
  const div = document.createElement("div");
  div.className = "sub-item-form";
  div.dataset.quillId = id;
  div.dataset.resultId = resultId;
  
  const hasResult = data?.result && (data.result.imageData || data.result.textResult);
  
  // Build files HTML with URL support
  const filesHtml = (data?.files || [])
    .map((f, fi) => {
      const hasUrl = f.url && f.url.trim();
      const contentStyle = hasUrl ? 'display:none;' : 'display:block;';
      return `
        <div class="latihan-file-row">
          <div class="file-input-group">
            <input type="text" class="file-name" placeholder="Nama file (contoh: App.js)" value="${escapeHTML(f.name)}" />
            <input type="text" class="file-url" placeholder="URL GitHub (https://github.com/...)" value="${escapeHTML(f.url || '')}" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:.8rem;background:var(--bg);color:var(--text);" />
            <textarea class="file-content" rows="1" placeholder="Kode program (opsional jika ada URL)..." style="${contentStyle}">${escapeHTML(f.content || '')}</textarea>
          </div>
          <button class="btn btn-sm btn-danger" onclick="this.closest('.latihan-file-row').remove()">✕</button>
        </div>
      `;
    })
    .join("");
  
  div.innerHTML = `
    <div class="sub-item-header">
      <span class="sub-item-title">🏋️ Latihan #${idx + 1}</span>
      <button class="btn btn-sm btn-danger" onclick="this.closest('.sub-item-form').remove()">✕</button>
    </div>
    <input type="text" class="latihan-title" placeholder="Judul Latihan" value="${escapeHTML(data?.title || "")}" style="width:100%;margin-bottom:4px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:.8rem;" />
    <div style="margin-bottom:4px;">
      <span class="text-sm">📝 Deskripsi</span>
      <div id="${id}"></div>
    </div>
    <div>
      <div class="row-between" style="margin-bottom:4px;">
        <span class="text-sm">📁 File / Link GitHub</span>
        <button class="btn btn-sm" onclick="addFileToLatihan(this)">+ File</button>
      </div>
      <div class="latihan-files">${filesHtml}</div>
    </div>
    
    <!-- HASIL LATIHAN -->
    <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">
      <div class="row-between" style="margin-bottom:4px;">
        <span class="text-sm">📊 Hasil Latihan</span>
        <button class="btn btn-sm btn-outline" onclick="toggleLatihanResult(this)">${hasResult ? '📊 Sembunyi Hasil' : '📊 Tambah Hasil'}</button>
      </div>
      <div class="latihan-result-section" style="${hasResult ? 'display:block;' : 'display:none;'}">
        <div id="${resultId}"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0;">
          <button class="btn btn-sm btn-outline" onclick="toggleResultTypeInSection(this, 'image')">🖼️ Gambar</button>
          <button class="btn btn-sm btn-outline" onclick="toggleResultTypeInSection(this, 'text')">📝 Text</button>
        </div>
        <div class="result-image-section" style="${data?.result?.type === 'image' ? 'display:block;' : 'display:none;'}">
          <div class="result-image-preview" style="margin:6px 0;">
            ${data?.result?.imageData ? `<img src="${data.result.imageData}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border);" />` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm" onclick="uploadResultImageInSection(this)">📤 Upload Gambar</button>
            <button class="btn btn-sm btn-danger" onclick="removeResultImageInSection(this)" ${data?.result?.imageData ? '' : 'style="display:none;"'}>✕ Hapus</button>
            <input type="file" class="result-image-input" accept="image/*" style="display:none;" onchange="handleResultImageUploadInSection(this)" />
            <input type="hidden" class="result-image-data" value="${escapeHTML(data?.result?.imageData || '')}" />
          </div>
        </div>
        <div class="result-text-section" style="${data?.result?.type === 'text' ? 'display:block;' : 'display:none;'}">
          <textarea class="result-text-content" rows="3" placeholder="Tulis hasil output di sini..." style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:.75rem;background:var(--surface);color:var(--text);resize:vertical;min-height:60px;">${escapeHTML(data?.result?.textResult || '')}</textarea>
        </div>
      </div>
    </div>
  `;
  list.appendChild(div);

  setTimeout(() => {
    const quill = initQuill(id, "latihan_" + id);
    if (quill && data?.description) quill.root.innerHTML = data.description;
    
    const resultQuill = initQuill(resultId, "latihanresult_" + resultId);
    if (resultQuill && data?.result?.description) {
      resultQuill.root.innerHTML = data.result.description;
    }
    
    // Setup auto-expand for textareas
    div.querySelectorAll("textarea.file-content").forEach(function (textarea) {
      textarea.dataset.autoExpandSetup = "true";
      autoExpandTextarea(textarea);
    });
    
    // Setup URL input behavior
    div.querySelectorAll("input.file-url").forEach(function (input) {
      // Set initial state
      const row = input.closest('.latihan-file-row');
      const contentTextarea = row.querySelector('.file-content');
      if (input.value && input.value.trim()) {
        contentTextarea.style.display = 'none';
      } else {
        contentTextarea.style.display = 'block';
      }
      
      // Add event listener for changes
      input.addEventListener('input', function() {
        const currentRow = this.closest('.latihan-file-row');
        const textarea = currentRow.querySelector('.file-content');
        if (this.value && this.value.trim()) {
          textarea.style.display = 'none';
        } else {
          textarea.style.display = 'block';
        }
      });
    });
  }, 50);
}

function toggleLatihanResult(btn) {
  const item = btn.closest('.sub-item-form');
  const section = item.querySelector('.latihan-result-section');
  if (section.style.display === 'none') {
    section.style.display = 'block';
    btn.textContent = '📊 Sembunyi Hasil';
  } else {
    section.style.display = 'none';
    btn.textContent = '📊 Tambah Hasil';
  }
}

function addFileToLatihan(btn) {
  const container = btn
    .closest(".sub-item-form")
    .querySelector(".latihan-files");
  const div = document.createElement("div");
  div.className = "latihan-file-row";
  div.innerHTML = `
    <div class="file-input-group">
      <input type="text" class="file-name" placeholder="Nama file (contoh: App.js)" />
      <input type="text" class="file-url" placeholder="URL GitHub (https://github.com/...)" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:.8rem;background:var(--bg);color:var(--text);" />
      <textarea class="file-content" rows="1" placeholder="Kode program (opsional jika ada URL)..." style="display:block;"></textarea>
    </div>
    <button class="btn btn-sm btn-danger" onclick="this.closest('.latihan-file-row').remove()">✕</button>
  `;
  container.appendChild(div);

  // Setup auto-expand for textarea
  const textarea = div.querySelector("textarea.file-content");
  textarea.dataset.autoExpandSetup = "true";
  autoExpandTextarea(textarea);
  
  // Setup URL input behavior
  const urlInput = div.querySelector("input.file-url");
  urlInput.addEventListener('input', function() {
    const row = this.closest('.latihan-file-row');
    const contentTextarea = row.querySelector('.file-content');
    if (this.value && this.value.trim()) {
      contentTextarea.style.display = 'none';
    } else {
      contentTextarea.style.display = 'block';
    }
  });
}

function getLatihans() {
  const items = document.querySelectorAll("#latihanList .sub-item-form");
  const result = [];
  items.forEach((item) => {
    const title = item.querySelector(".latihan-title")?.value || "";
    const quillId = item.dataset.quillId;
    let description = "";
    if (quillId && window[quillId]) {
      description = window[quillId].root.innerHTML;
    }
    const files = [];
    item.querySelectorAll(".latihan-file-row").forEach((el) => {
      const name = el.querySelector(".file-name")?.value;
      const url = el.querySelector(".file-url")?.value;
      const content = el.querySelector(".file-content")?.value;
      if (name && name.trim()) {
        const fileObj = { name: name.trim() };
        if (url && url.trim()) {
          fileObj.url = url.trim();
        }
        if (content && content.trim()) {
          fileObj.content = content.trim();
        }
        files.push(fileObj);
      }
    });
    
    const resultSection = item.querySelector('.latihan-result-section');
    let resultData = null;
    if (resultSection) {
      const imageData = resultSection.querySelector('.result-image-data')?.value || '';
      const textResult = resultSection.querySelector('.result-text-content')?.value || '';
      const descQuillId = resultSection.querySelector('[id^="latihanResult_"]')?.id || '';
      let descriptionResult = '';
      if (descQuillId && window[descQuillId]) {
        descriptionResult = window[descQuillId].root.innerHTML;
      }
      
      const imageSection = resultSection.querySelector('.result-image-section');
      const isImageVisible = imageSection && imageSection.style.display !== 'none';
      
      let type = "none";
      if (isImageVisible && imageData) type = "image";
      else if (textResult) type = "text";
      
      if (imageData || textResult) {
        resultData = {
          description: descriptionResult.trim(),
          imageData: imageData || "",
          textResult: textResult || "",
          type: type
        };
      }
    }
    
    if (files.length || resultData || title) {
      const obj = { 
        title: title || "Latihan", 
        description: description.trim(), 
        files: files
      };
      if (resultData) obj.result = resultData;
      result.push(obj);
    }
  });
  return result;
}

function setLatihans(data) {
  const list = document.getElementById("latihanList");
  if (!list) return;
  list.innerHTML = "";
  if (data && data.length) data.forEach((d) => addLatihanToForm(d));
}

const addLatihanBtn = document.getElementById("addLatihanBtn");
if (addLatihanBtn) {
  addLatihanBtn.addEventListener("click", () => addLatihanToForm());
}

// ============================================================
// BREAK & FIX (modal form)
// ============================================================
function addBreakfixToForm(data = null) {
  const list = document.getElementById("breakfixList");
  if (!list) return;
  const idx = list.children.length;
  const descId = "bfDesc_" + Date.now() + "_" + state.breakfixQuillIdCounter++;
  const hintId = "bfHint_" + Date.now() + "_" + state.breakfixQuillIdCounter++;
  const solId = "bfSol_" + Date.now() + "_" + state.breakfixQuillIdCounter++;
  const resultId = "bfResult_" + Date.now() + "_" + state.breakfixQuillIdCounter++;
  
  const div = document.createElement("div");
  div.className = "sub-item-form";
  div.dataset.descId = descId;
  div.dataset.hintId = hintId;
  div.dataset.solId = solId;
  div.dataset.resultId = resultId;
  
  const hasResult = data?.result && (data.result.imageData || data.result.textResult);
  
  div.innerHTML = `
    <div class="sub-item-header">
      <span class="sub-item-title">🐛 Break & Fix #${idx + 1}</span>
      <div style="display:flex;gap:4px;align-items:center;">
        <label style="font-size:.7rem;display:flex;align-items:center;gap:3px;"><input type="checkbox" class="bf-solved" ${data?.solved ? "checked" : ""} /> ✅ Solved</label>
        <button class="btn btn-sm btn-danger" onclick="this.closest('.sub-item-form').remove()">✕</button>
      </div>
    </div>
    <input type="text" class="bf-title" placeholder="Judul" value="${escapeHTML(data?.title || "")}" style="width:100%;margin-bottom:4px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:.8rem;" />
    <div style="margin-bottom:4px;">
      <span class="text-sm">📝 Deskripsi</span>
      <div id="${descId}"></div>
    </div>
    <div class="breakfix-row">
      <div><span class="text-sm">🔴 Broken</span><textarea class="bf-broken" rows="1" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:.75rem;background:var(--surface);color:var(--text);">${escapeHTML(data?.brokenCode || "")}</textarea></div>
      <div><span class="text-sm">🟢 Fixed</span><textarea class="bf-fixed" rows="1" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:.75rem;background:var(--surface);color:var(--text);">${escapeHTML(data?.fixedCode || "")}</textarea></div>
    </div>
    <div style="margin-top:4px;">
      <button class="btn btn-sm btn-outline" onclick="toggleBF(this)">💡 Hint</button>
      <div class="bf-hint" style="display:none;margin-top:4px;">
        <span class="text-sm">💡 Hint</span>
        <div id="${hintId}"></div>
      </div>
      <button class="btn btn-sm btn-outline" onclick="toggleBF(this)">✅ Solusi</button>
      <div class="bf-solution" style="display:none;margin-top:4px;">
        <span class="text-sm">✅ Solusi</span>
        <div id="${solId}"></div>
      </div>
    </div>
    <button class="btn btn-sm btn-outline" onclick="previewBF(this)">🔍 Diff</button>
    
    <!-- HASIL BREAKFIX -->
    <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">
      <div class="row-between" style="margin-bottom:4px;">
        <span class="text-sm">📊 Hasil Perbaikan</span>
        <button class="btn btn-sm btn-outline" onclick="toggleBreakfixResult(this)">${hasResult ? '📊 Sembunyi Hasil' : '📊 Tambah Hasil'}</button>
      </div>
      <div class="breakfix-result-section" style="${hasResult ? 'display:block;' : 'display:none;'}">
        <div id="${resultId}"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0;">
          <button class="btn btn-sm btn-outline" onclick="toggleResultTypeInSection(this, 'image')">🖼️ Gambar</button>
          <button class="btn btn-sm btn-outline" onclick="toggleResultTypeInSection(this, 'text')">📝 Text</button>
        </div>
        <div class="result-image-section" style="${data?.result?.type === 'image' ? 'display:block;' : 'display:none;'}">
          <div class="result-image-preview" style="margin:6px 0;">
            ${data?.result?.imageData ? `<img src="${data.result.imageData}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border);" />` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm" onclick="uploadResultImageInSection(this)">📤 Upload Gambar</button>
            <button class="btn btn-sm btn-danger" onclick="removeResultImageInSection(this)" ${data?.result?.imageData ? '' : 'style="display:none;"'}>✕ Hapus</button>
            <input type="file" class="result-image-input" accept="image/*" style="display:none;" onchange="handleResultImageUploadInSection(this)" />
            <input type="hidden" class="result-image-data" value="${escapeHTML(data?.result?.imageData || '')}" />
          </div>
        </div>
        <div class="result-text-section" style="${data?.result?.type === 'text' ? 'display:block;' : 'display:none;'}">
          <textarea class="result-text-content" rows="3" placeholder="Tulis hasil perbaikan di sini..." style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:.75rem;background:var(--surface);color:var(--text);resize:vertical;min-height:60px;">${escapeHTML(data?.result?.textResult || '')}</textarea>
        </div>
      </div>
    </div>
  `;
  list.appendChild(div);

  setTimeout(() => {
    const q1 = initQuill(descId, "bfdesc_" + descId);
    if (q1 && data?.description) q1.root.innerHTML = data.description;
    const q2 = initQuill(hintId, "bfhint_" + hintId);
    if (q2 && data?.hint) q2.root.innerHTML = data.hint;
    const q3 = initQuill(solId, "bfsol_" + solId);
    if (q3 && data?.solution) q3.root.innerHTML = data.solution;
    
    const resultQuill = initQuill(resultId, "bfresult_" + resultId);
    if (resultQuill && data?.result?.description) {
      resultQuill.root.innerHTML = data.result.description;
    }

    div.querySelectorAll(".bf-broken, .bf-fixed").forEach(function (textarea) {
      textarea.dataset.autoExpandSetup = "true";
      autoExpandTextarea(textarea);
    });
  }, 50);
}

function toggleBF(btn) {
  const parent = btn.closest(".sub-item-form");
  const isHint = btn.textContent.includes("Hint");
  const target = isHint
    ? parent.querySelector(".bf-hint")
    : parent.querySelector(".bf-solution");
  if (target) {
    target.style.display = target.style.display === "none" ? "block" : "none";
    btn.textContent =
      target.style.display === "none"
        ? isHint
          ? "💡 Hint"
          : "✅ Solusi"
        : isHint
          ? "💡 Sembunyi"
          : "✅ Sembunyi";
  }
}

function toggleBreakfixResult(btn) {
  const item = btn.closest('.sub-item-form');
  const section = item.querySelector('.breakfix-result-section');
  if (section.style.display === 'none') {
    section.style.display = 'block';
    btn.textContent = '📊 Sembunyi Hasil';
  } else {
    section.style.display = 'none';
    btn.textContent = '📊 Tambah Hasil';
  }
}

function previewBF(btn) {
  const item = btn.closest(".sub-item-form");
  const title = item.querySelector(".bf-title")?.value || "Break & Fix";
  const broken = item.querySelector(".bf-broken")?.value || "";
  const fixed = item.querySelector(".bf-fixed")?.value || "";
  const descId = item.dataset.descId;
  const hintId = item.dataset.hintId;
  const solId = item.dataset.solId;
  let desc = "",
    hint = "",
    sol = "";
  if (descId && window[descId]) {
    desc = window[descId].root.innerHTML;
  }
  if (hintId && window[hintId]) {
    hint = window[hintId].root.innerHTML;
  }
  if (solId && window[solId]) {
    sol = window[solId].root.innerHTML;
  }

  const br = broken.split("\n");
  const fi = fixed.split("\n");
  const maxLen = Math.max(br.length, fi.length);
  let rows = "";
  for (let i = 0; i < maxLen; i++) {
    const b = br[i] || "";
    const f = fi[i] || "";
    const diff = b !== f;
    rows += `<tr class="${diff ? "diff-different" : ""}">
                        <td class="diff-line-num">${i + 1}</td>
                        <td class="${!b && f ? "diff-removed" : ""}">${escapeHTML(b) || "&nbsp;"}</td>
                        <td class="diff-line-num">${i + 1}</td>
                        <td class="${b && !f ? "diff-added" : ""}">${escapeHTML(f) || "&nbsp;"}</td>
                    </tr>`;
  }

  const diffBody = document.getElementById("diffBody");
  if (diffBody) {
    diffBody.innerHTML = `
                    <h3 style="font-size:.95rem;margin-bottom:6px;">${escapeHTML(title)}</h3>
                    ${desc ? `<div style="margin-bottom:8px;"><strong>📝 Deskripsi:</strong> <div class="ql-editor" style="padding:0;">${desc}</div></div>` : ""}
                    <table class="diff-table">
                        <thead><tr><th>#</th><th>🔴 Broken</th><th>#</th><th>🟢 Fixed</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="diff-legend">
                        <span>🟡 Berubah</span>
                        <span>🟢 Ditambahkan</span>
                        <span>🔴 Dihapus</span>
                    </div>
                    ${hint ? `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;"><strong>💡 Hint:</strong> <div class="ql-editor" style="padding:0;">${hint}</div></div>` : ""}
                    ${sol ? `<div><strong>✅ Solusi:</strong> <div class="ql-editor" style="padding:0;">${sol}</div></div>` : ""}
                `;
  }
  
  const diffModal = document.getElementById("diffModal");
  if (diffModal) diffModal.classList.remove("hidden");
}

function getBreakfixs() {
  const items = document.querySelectorAll("#breakfixList .sub-item-form");
  const result = [];
  items.forEach((item) => {
    const title = item.querySelector(".bf-title")?.value || "";
    const broken = item.querySelector(".bf-broken")?.value || "";
    const fixed = item.querySelector(".bf-fixed")?.value || "";
    const solved = item.querySelector(".bf-solved")?.checked || false;
    const descId = item.dataset.descId;
    const hintId = item.dataset.hintId;
    const solId = item.dataset.solId;
    let description = "",
      hint = "",
      solution = "";
    if (descId && window[descId]) {
      description = window[descId].root.innerHTML;
    }
    if (hintId && window[hintId]) {
      hint = window[hintId].root.innerHTML;
    }
    if (solId && window[solId]) {
      solution = window[solId].root.innerHTML;
    }
    
    const resultSection = item.querySelector('.breakfix-result-section');
    let resultData = null;
    if (resultSection) {
      const imageData = resultSection.querySelector('.result-image-data')?.value || '';
      const textResult = resultSection.querySelector('.result-text-content')?.value || '';
      const descQuillId = resultSection.querySelector('[id^="bfResult_"]')?.id || '';
      let descriptionResult = '';
      if (descQuillId && window[descQuillId]) {
        descriptionResult = window[descQuillId].root.innerHTML;
      }
      
      const imageSection = resultSection.querySelector('.result-image-section');
      const isImageVisible = imageSection && imageSection.style.display !== 'none';
      
      let type = "none";
      if (isImageVisible && imageData) type = "image";
      else if (textResult) type = "text";
      
      if (imageData || textResult) {
        resultData = {
          description: descriptionResult.trim(),
          imageData: imageData || "",
          textResult: textResult || "",
          type: type
        };
      }
    }
    
    if (broken || fixed || resultData) {
      const obj = {
        title: title || "Break & Fix",
        description: description.trim(),
        brokenCode: broken,
        fixedCode: fixed,
        hint: hint.trim(),
        solution: solution.trim(),
        solved: solved
      };
      if (resultData) obj.result = resultData;
      result.push(obj);
    }
  });
  return result;
}

function setBreakfixs(data) {
  const list = document.getElementById("breakfixList");
  if (!list) return;
  list.innerHTML = "";
  if (data && data.length) data.forEach((d) => addBreakfixToForm(d));
}

const addBreakfixBtn = document.getElementById("addBreakfixBtn");
if (addBreakfixBtn) {
  addBreakfixBtn.addEventListener("click", () => addBreakfixToForm());
}

// ============================================================
// PROGRAM (modal form)
// ============================================================
function addProgramToForm(data = null) {
  const list = document.getElementById("programList");
  if (!list) return;
  const idx = list.children.length;
  const id = "progDesc_" + Date.now() + "_" + state.programQuillIdCounter++;
  const resultId = "progResult_" + Date.now() + "_" + state.programQuillIdCounter++;
  
  const div = document.createElement("div");
  div.className = "sub-item-form";
  div.dataset.quillId = id;
  div.dataset.resultId = resultId;
  
  const hasResult = data?.result && (data.result.imageData || data.result.textResult);
  
  div.innerHTML = `
    <div class="sub-item-header">
      <span class="sub-item-title">💻 Program #${idx + 1}</span>
      <button class="btn btn-sm btn-danger" onclick="this.closest('.sub-item-form').remove()">✕</button>
    </div>
    <input type="text" class="prog-title" placeholder="Judul Program" value="${escapeHTML(data?.title || "")}" style="width:100%;margin-bottom:4px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:.8rem;" />
    <div style="margin-bottom:4px;">
      <span class="text-sm">📝 Deskripsi</span>
      <div id="${id}"></div>
    </div>
    <textarea class="prog-code" rows="1" placeholder="Kode program..." style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:.75rem;background:var(--surface);color:var(--text);">${escapeHTML(data?.code || "")}</textarea>
    
    <!-- HASIL PROGRAM -->
    <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">
      <div class="row-between" style="margin-bottom:4px;">
        <span class="text-sm">📊 Hasil Eksekusi</span>
        <button class="btn btn-sm btn-outline" onclick="toggleProgramResult(this)">${hasResult ? '📊 Sembunyi Hasil' : '📊 Tambah Hasil'}</button>
      </div>
      <div class="program-result-section" style="${hasResult ? 'display:block;' : 'display:none;'}">
        <div id="${resultId}"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0;">
          <button class="btn btn-sm btn-outline" onclick="toggleResultTypeInSection(this, 'image')">🖼️ Gambar</button>
          <button class="btn btn-sm btn-outline" onclick="toggleResultTypeInSection(this, 'text')">📝 Text</button>
        </div>
        <div class="result-image-section" style="${data?.result?.type === 'image' ? 'display:block;' : 'display:none;'}">
          <div class="result-image-preview" style="margin:6px 0;">
            ${data?.result?.imageData ? `<img src="${data.result.imageData}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border);" />` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm" onclick="uploadResultImageInSection(this)">📤 Upload Gambar</button>
            <button class="btn btn-sm btn-danger" onclick="removeResultImageInSection(this)" ${data?.result?.imageData ? '' : 'style="display:none;"'}>✕ Hapus</button>
            <input type="file" class="result-image-input" accept="image/*" style="display:none;" onchange="handleResultImageUploadInSection(this)" />
            <input type="hidden" class="result-image-data" value="${escapeHTML(data?.result?.imageData || '')}" />
          </div>
        </div>
        <div class="result-text-section" style="${data?.result?.type === 'text' ? 'display:block;' : 'display:none;'}">
          <textarea class="result-text-content" rows="3" placeholder="Tulis output program di sini..." style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:.75rem;background:var(--surface);color:var(--text);resize:vertical;min-height:60px;">${escapeHTML(data?.result?.textResult || '')}</textarea>
        </div>
      </div>
    </div>
  `;
  list.appendChild(div);
  
  setTimeout(() => {
    const q = initQuill(id, "prog_" + id);
    if (q && data?.description) q.root.innerHTML = data.description;
    
    const resultQuill = initQuill(resultId, "progresult_" + resultId);
    if (resultQuill && data?.result?.description) {
      resultQuill.root.innerHTML = data.result.description;
    }

    const textarea = div.querySelector(".prog-code");
    textarea.dataset.autoExpandSetup = "true";
    autoExpandTextarea(textarea);
  }, 50);
}

function toggleProgramResult(btn) {
  const item = btn.closest('.sub-item-form');
  const section = item.querySelector('.program-result-section');
  if (section.style.display === 'none') {
    section.style.display = 'block';
    btn.textContent = '📊 Sembunyi Hasil';
  } else {
    section.style.display = 'none';
    btn.textContent = '📊 Tambah Hasil';
  }
}

function getPrograms() {
  const items = document.querySelectorAll("#programList .sub-item-form");
  const result = [];
  items.forEach((item) => {
    const title = item.querySelector(".prog-title")?.value || "";
    const code = item.querySelector(".prog-code")?.value || "";
    const quillId = item.dataset.quillId;
    let description = "";
    if (quillId && window[quillId]) {
      description = window[quillId].root.innerHTML;
    }
    
    const resultSection = item.querySelector('.program-result-section');
    let resultData = null;
    if (resultSection) {
      const imageData = resultSection.querySelector('.result-image-data')?.value || '';
      const textResult = resultSection.querySelector('.result-text-content')?.value || '';
      const descQuillId = resultSection.querySelector('[id^="progResult_"]')?.id || '';
      let descriptionResult = '';
      if (descQuillId && window[descQuillId]) {
        descriptionResult = window[descQuillId].root.innerHTML;
      }
      
      const imageSection = resultSection.querySelector('.result-image-section');
      const isImageVisible = imageSection && imageSection.style.display !== 'none';
      
      let type = "none";
      if (isImageVisible && imageData) type = "image";
      else if (textResult) type = "text";
      
      if (imageData || textResult) {
        resultData = {
          description: descriptionResult.trim(),
          imageData: imageData || "",
          textResult: textResult || "",
          type: type
        };
      }
    }
    
    if (code || resultData || title) {
      const obj = { 
        title: title || "Program", 
        description: description.trim(), 
        code: code
      };
      if (resultData) obj.result = resultData;
      result.push(obj);
    }
  });
  return result;
}

function setPrograms(data) {
  const list = document.getElementById("programList");
  if (!list) return;
  list.innerHTML = "";
  if (data && data.length) data.forEach((d) => addProgramToForm(d));
}

const addProgramBtn = document.getElementById("addProgramBtn");
if (addProgramBtn) {
  addProgramBtn.addEventListener("click", () => addProgramToForm());
}

// ============================================================
// SAVE
// ============================================================
const saveNoteBtn = document.getElementById("saveNote");
if (saveNoteBtn) {
  saveNoteBtn.addEventListener("click", async () => {
    const titleEl = document.getElementById("noteTitle");
    const title = titleEl ? titleEl.value.trim() : "";
    if (!title) {
      showToast("Judul wajib diisi!", true);
      return;
    }

    const now = new Date().toLocaleDateString("id-ID");
    const understanding =
      document.querySelector('input[name="understanding"]:checked')?.value ||
      "belum";
    const fundamentalType =
      document.querySelector('input[name="fundamentalType"]:checked')?.value ||
      "nonfundamental";
    const categoryEl = document.getElementById("noteCategory");
    const category = categoryEl ? categoryEl.value : "Umum";
    const syntaxEl = document.getElementById("noteSyntaxCode");
    const syntaxCode = syntaxEl ? syntaxEl.value : "";

    const note = {
      title,
      category,
      understanding,
      fundamentalType,
      syntaxCode,
      understand: getQuillContent("quillUnderstand", "understand"),
      notUnderstand: getQuillContent("quillNotUnderstand", "notUnderstand"),
      commonMistakes: getQuillContent("quillCommonMistakes", "commonMistakes"),
      latihans: getLatihans(),
      breakfixs: getBreakfixs(),
      programs: getPrograms(),
      created: now,
      edited: now,
      pin: false,
      favorite: false,
    };

    if (state.editingIndex !== null) {
      const existing = state.notes.find((n) => n.id === state.editingIndex);
      if (existing) {
        note.created = existing.created;
        note.pin = existing.pin;
        note.favorite = existing.favorite;
        note.id = existing.id;
        const idx = state.notes.indexOf(existing);
        state.notes[idx] = note;
      }
      showToast("Catatan diperbarui");
    } else {
      const newId = state.notes.length
        ? Math.max(...state.notes.map((n) => n.id)) + 1
        : 0;
      note.id = newId;
      state.notes.push(note);
      showToast("Catatan ditambahkan");
    }

    await saveToStorage();
    render();
    closeEditModal();
  });
}

// ============================================================
// EXPORT / IMPORT
// ============================================================
const exportBtn = document.getElementById("exportBtn");
if (exportBtn) exportBtn.addEventListener("click", exportNotes);

const importBtn = document.getElementById("importBtn");
if (importBtn) {
  importBtn.addEventListener("click", () => {
    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.click();
  });
}

const fileInput = document.getElementById("fileInput");
if (fileInput) {
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) {
          state.notes = data.map((n, i) => ({ ...n, id: i }));
          await saveToStorage();
          render();
          showToast("📥 Import sukses");
        } else {
          showToast("Format tidak valid", true);
        }
      } catch (err) {
        showToast("File rusak", true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
}

// ============================================================
// FILTERS
// ============================================================
const categorySelect = document.getElementById("categorySelect");
if (categorySelect) {
  categorySelect.addEventListener("change", (e) => {
    state.selectedCategory = e.target.value;
    render();
  });
}

const understandingFilter = document.getElementById("understandingFilter");
if (understandingFilter) {
  understandingFilter.addEventListener("change", (e) => {
    state.understandingFilter = e.target.value;
    render();
  });
}

const sortBy = document.getElementById("sortBy");
if (sortBy) {
  sortBy.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    render();
  });
}

const resetFilter = document.getElementById("resetFilter");
if (resetFilter) {
  resetFilter.addEventListener("click", () => {
    state.selectedCategory = "ALL";
    state.understandingFilter = "ALL";
    state.sortBy = "default";
    const catSelect = document.getElementById("categorySelect");
    if (catSelect) catSelect.value = "ALL";
    const undFilter = document.getElementById("understandingFilter");
    if (undFilter) undFilter.value = "ALL";
    const sortSelect = document.getElementById("sortBy");
    if (sortSelect) sortSelect.value = "default";
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";
    render();
    showToast("Filter direset");
  });
}

const searchInput = document.getElementById("searchInput");
if (searchInput) searchInput.addEventListener("input", render);

// ============================================================
// THEME
// ============================================================
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    themeToggle.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("catatan_theme", isDark ? "dark" : "light");
  });
}

// ============================================================
// INIT
// ============================================================
async function init() {
  const savedTheme = localStorage.getItem("catatan_theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    const themeToggleEl = document.getElementById("themeToggle");
    if (themeToggleEl) themeToggleEl.textContent = "☀️";
  }

  setupAutoExpand(
    ".latihan-file-row textarea.file-content, .prog-code, .bf-broken, .bf-fixed",
  );

  window.quillUnderstand = initQuill("quillEditorUnderstand", "understand");
  window.quillNotUnderstand = initQuill(
    "quillEditorNotUnderstand",
    "notUnderstand",
  );
  window.quillCommonMistakes = initQuill(
    "quillEditorCommonMistakes",
    "commonMistakes",
  );

  initToggles();

  await loadFromStorage();

  render();
  updateSyncStatus("💾 Tersimpan");
  console.log("✅ CatatanKu — Satu Halaman Satu Catatan siap");
}

document.addEventListener("DOMContentLoaded", () => {
  init();
});