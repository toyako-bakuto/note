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
  isModalOpen: false, // Track modal state
};

// ============================================================
// SERVER API FUNCTIONS (PHP save-data)
// ============================================================
const API_URL = "save-data.php";

// Fungsi untuk menyimpan ke server
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

// Fungsi untuk mengambil dari server
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

// Fungsi untuk reset data di server
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
// Gabungan: simpan ke localStorage dan server
async function saveToStorage() {
  try {
    // Simpan ke localStorage
    localStorage.setItem("notes_minimal", JSON.stringify(state.notes));

    // Simpan ke server
    await saveToServer(state.notes);

    updateSyncStatus("💾 Tersimpan");
    return true;
  } catch (e) {
    console.error("Save error:", e);
    return false;
  }
}

// Gabungan: load dari localStorage atau server
async function loadFromStorage() {
  try {
    // Coba dari localStorage dulu
    const localData = localStorage.getItem("notes_minimal");
    let hasLocalData = false;
    let parsedData = null;

    if (localData) {
      try {
        parsedData = JSON.parse(localData);
        if (Array.isArray(parsedData) && parsedData.length) {
          hasLocalData = true;
        }
      } catch (e) {
        // Invalid JSON
      }
    }

    // Coba dari server
    const serverData = await loadFromServer();

    if (serverData && Array.isArray(serverData) && serverData.length) {
      // Server memiliki data
      if (hasLocalData) {
        // Jika ada data di kedua tempat, gunakan yang lebih baru
        // Untuk sederhana, kita gunakan server data
        state.notes = serverData.map((n, i) => ({ ...n, id: i }));
        // Update localStorage juga
        localStorage.setItem("notes_minimal", JSON.stringify(state.notes));
        updateSyncStatus("💾 Load dari server");
        return true;
      } else {
        state.notes = serverData.map((n, i) => ({ ...n, id: i }));
        localStorage.setItem("notes_minimal", JSON.stringify(state.notes));
        updateSyncStatus("💾 Load dari server");
        return true;
      }
    } else if (hasLocalData && parsedData) {
      // Gunakan data lokal jika server kosong
      state.notes = parsedData.map((n, i) => ({ ...n, id: i }));
      // Kirim ke server
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

  // Also run on DOM changes (for dynamically added elements)
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

  // Initial setup
  document.querySelectorAll(selector).forEach(function (textarea) {
    textarea.dataset.autoExpandSetup = "true";
    autoExpandTextarea(textarea);
  });
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateToNote(index) {
  const filtered = sortNotes(getFilteredNotes());
  if (!filtered.length) {
    state.currentNoteIndex = 0;
    renderSingleNote(null);
    updateNavButtons(0, 0);
    return;
  }
  if (index < 0) index = filtered.length - 1;
  if (index >= filtered.length) index = 0;
  state.currentNoteIndex = index;
  renderSingleNote(filtered[index]);
  updateNavButtons(index, filtered.length);
}

function updateNavButtons(currentIndex, total) {
  const prevBtn = document.getElementById("prevNoteNav");
  const nextBtn = document.getElementById("nextNoteNav");
  const counter = document.getElementById("navCounter");
  if (prevBtn) prevBtn.disabled = total === 0 || currentIndex <= 0;
  if (nextBtn) nextBtn.disabled = total === 0 || currentIndex >= total - 1;
  if (counter)
    counter.textContent =
      total > 0 ? `${currentIndex + 1} / ${total}` : "0 / 0";
  document.getElementById("totalNotes").textContent = `${total} catatan`;
}

function goPrevNote() {
  // Jangan navigasi jika modal terbuka
  if (state.isModalOpen) return;
  const filtered = sortNotes(getFilteredNotes());
  if (!filtered.length) return;
  const newIdx =
    state.currentNoteIndex > 0
      ? state.currentNoteIndex - 1
      : filtered.length - 1;
  navigateToNote(newIdx);
}

function goNextNote() {
  // Jangan navigasi jika modal terbuka
  if (state.isModalOpen) return;
  const filtered = sortNotes(getFilteredNotes());
  if (!filtered.length) return;
  const newIdx =
    state.currentNoteIndex < filtered.length - 1
      ? state.currentNoteIndex + 1
      : 0;
  navigateToNote(newIdx);
}

// Keyboard navigation - DIPERBAIKI dengan cek modal
document.addEventListener("keydown", (e) => {
  // Cek apakah modal terbuka
  if (state.isModalOpen) return;

  // Cek apakah sedang fokus di input/textarea/select
  const target = e.target;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
    return;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    goPrevNote();
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    goNextNote();
  }
});

// ============================================================
// RENDER SINGLE NOTE
// ============================================================
function renderSingleNote(note) {
  const container = document.getElementById("noteDisplay");
  if (!note) {
    container.innerHTML = `<div class="empty-state"><h3>📭 Belum ada catatan</h3><p>Klik "Tambah" untuk mulai</p></div>`;
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

  // Latihan - tampilkan seperti program dengan file content
  let latihanHtml = "";
  if (n.latihans && n.latihans.length) {
    latihanHtml = n.latihans
      .map((l, li) => {
        const filesHtml = (l.files || [])
          .map(
            (f) => `
                            <div class="file-item-wrapper">
                                <div class="file-header">
                                    ${getFileIcon(f.name)} ${escapeHTML(f.name)}
                                </div>
                                <div class="file-content-display">${escapeHTML(f.content)}</div>
                            </div>
                        `,
          )
          .join("");
        return `
                            <div class="sub-item">
                                <div class="sub-item-header">
                                    <span class="sub-item-title">🏋️ ${escapeHTML(l.title || "Latihan")}</span>
                                    <span class="sub-item-meta">${(l.files || []).length} file</span>
                                </div>
                                ${l.description ? `<div class="text-sm">${escapeHTML(stripHtml(l.description))}</div>` : ""}
                                <div class="file-list">${filesHtml}</div>
                            </div>
                        `;
      })
      .join("");
  }

  // Break & Fix
  let breakfixHtml = "";
  if (n.breakfixs && n.breakfixs.length) {
    breakfixHtml = n.breakfixs
      .map(
        (b, bi) => `
                        <div class="sub-item">
                            <div class="sub-item-header">
                                <span class="sub-item-title">🐛 ${escapeHTML(b.title || "Break & Fix")}</span>
                                <span class="sub-item-meta">${b.solved ? "✅ Solved" : "⏳ In Progress"}</span>
                            </div>
                            ${b.description ? `<div class="text-sm">${escapeHTML(stripHtml(b.description))}</div>` : ""}
                            <div class="breakfix-row">
                                ${b.brokenCode ? `<div><span class="text-sm">🔴 Broken</span><div class="code-block broken">${escapeHTML(b.brokenCode)}</div></div>` : ""}
                                ${b.fixedCode ? `<div><span class="text-sm">🟢 Fixed</span><div class="code-block fixed">${escapeHTML(b.fixedCode)}</div></div>` : ""}
                            </div>
                            ${b.hint ? `<div class="text-sm">💡 ${escapeHTML(stripHtml(b.hint))}</div>` : ""}
                            <button class="btn btn-sm btn-outline" onclick="showDiff(${n.id},${bi})">🔍 Diff</button>
                        </div>
                    `,
      )
      .join("");
  }

  // Program
  let programHtml = "";
  if (n.programs && n.programs.length) {
    programHtml = n.programs
      .map(
        (p, pi) => `
                        <div class="sub-item">
                            <div class="sub-item-header">
                                <span class="sub-item-title">💻 ${escapeHTML(p.title || "Program")}</span>
                            </div>
                            ${p.description ? `<div class="text-sm">${escapeHTML(stripHtml(p.description))}</div>` : ""}
                            ${p.code ? `<div class="code-block">${escapeHTML(p.code)}</div>` : ""}
                        </div>
                    `,
      )
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
                            <div class="note-meta">
                                ${n.created || "-"} ${n.edited && n.edited !== n.created ? "✏️ diedit" : ""}
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
  const cats = new Set(state.notes.map((n) => n.category || "Umum"));
  let html = '<option value="ALL">Semua Kategori</option>';
  cats.forEach((c) => (html += `<option value="${c}">${c}</option>`));
  sel.innerHTML = html;
  sel.value = state.selectedCategory;
}

// ============================================================
// WRAPPER RENDER
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
  document.getElementById("totalNotes").textContent = `${total} catatan`;
}

// ============================================================
// MODAL CONTROL - FIX SCROLL & KEYBOARD
// ============================================================
function openModal() {
  state.isModalOpen = true;
  document.body.classList.add("modal-open");
  document.getElementById("editModal").classList.remove("hidden");
}

function closeModal() {
  state.isModalOpen = false;
  document.body.classList.remove("modal-open");
  document.getElementById("editModal").classList.add("hidden");
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

  document.getElementById("diffBody").innerHTML = `
                    <table class="diff-table">
                        <thead><tr><th>#</th><th>🔴 Broken</th><th>#</th><th>🟢 Fixed</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="diff-legend">
                        <span>🟡 Berubah</span>
                        <span>🟢 Ditambahkan</span>
                        <span>🔴 Dihapus</span>
                    </div>
                    ${b.hint ? `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;"><strong>💡 Hint:</strong> ${escapeHTML(stripHtml(b.hint))}</div>` : ""}
                    ${b.solution ? `<div><strong>✅ Solusi:</strong> ${escapeHTML(stripHtml(b.solution))}</div>` : ""}
                `;
  document.getElementById("diffModal").classList.remove("hidden");
}

document.getElementById("closeDiffBtn").addEventListener("click", () => {
  document.getElementById("diffModal").classList.add("hidden");
});
document.getElementById("diffModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget)
    document.getElementById("diffModal").classList.add("hidden");
});

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
  document.getElementById("modalTitle").textContent =
    editId !== null ? "✏️ Edit Catatan" : "📝 Tambah Catatan";

  // Buka modal dengan fungsi yang sudah di-refactor
  openModal();

  if (noteData) {
    document.getElementById("noteTitle").value = noteData.title || "";
    document.getElementById("noteCategory").value = noteData.category || "Umum";
    document
      .querySelectorAll('input[name="understanding"]')
      .forEach(
        (r) => (r.checked = r.value === (noteData.understanding || "belum")),
      );
    document
      .querySelectorAll('input[name="fundamentalType"]')
      .forEach(
        (r) =>
          (r.checked =
            r.value === (noteData.fundamentalType || "nonfundamental")),
      );
    document.getElementById("noteSyntaxCode").value = noteData.syntaxCode || "";
    setQuillContent("quillUnderstand", "understand", noteData.understand || "");
    setQuillContent(
      "quillNotUnderstand",
      "notUnderstand",
      noteData.notUnderstand || "",
    );
    setQuillContent(
      "quillCommonMistakes",
      "commonMistakes",
      noteData.commonMistakes || "",
    );
    setLatihans(noteData.latihans || []);
    setBreakfixs(noteData.breakfixs || []);
    setPrograms(noteData.programs || []);
  } else {
    document.getElementById("noteTitle").value = "";
    document.getElementById("noteCategory").value = "Umum";
    document
      .querySelectorAll('input[name="understanding"]')
      .forEach((r) => (r.checked = r.value === "belum"));
    document
      .querySelectorAll('input[name="fundamentalType"]')
      .forEach((r) => (r.checked = r.value === "nonfundamental"));
    document.getElementById("noteSyntaxCode").value = "";
    setQuillContent("quillUnderstand", "understand", "");
    setQuillContent("quillNotUnderstand", "notUnderstand", "");
    setQuillContent("quillCommonMistakes", "commonMistakes", "");
    setLatihans([]);
    setBreakfixs([]);
    setPrograms([]);
  }

  // Setup auto-expand for textareas in modal
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

document
  .getElementById("addNoteBtn")
  .addEventListener("click", () => openEditModal(null, null));
document.getElementById("cancelEdit").addEventListener("click", closeEditModal);
document
  .getElementById("cancelEditBottom")
  .addEventListener("click", closeEditModal);

// Close modal with ESC key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.isModalOpen) {
    closeEditModal();
  }
});

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
// LATIHAN (modal form)
// ============================================================
function addLatihanToForm(data = null) {
  const list = document.getElementById("latihanList");
  const idx = list.children.length;
  const id = "latihanDesc_" + Date.now() + "_" + state.latihanQuillIdCounter++;
  const div = document.createElement("div");
  div.className = "sub-item-form";
  div.dataset.quillId = id;
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
                            <span class="text-sm">📁 File</span>
                            <button class="btn btn-sm" onclick="addFileToLatihan(this)">+ File</button>
                        </div>
                        <div class="latihan-files">${(data?.files || [])
                          .map(
                            (f, fi) => `
                                <div class="latihan-file-row">
                                    <div class="file-input-group">
                                        <input type="text" class="file-name" placeholder="Nama file (contoh: App.js)" value="${escapeHTML(f.name)}" />
                                        <textarea class="file-content" rows="1" placeholder="Kode program...">${escapeHTML(f.content)}</textarea>
                                    </div>
                                    <button class="btn btn-sm btn-danger" onclick="this.closest('.latihan-file-row').remove()">✕</button>
                                </div>
                            `,
                          )
                          .join("")}</div>
                    </div>
                `;
  list.appendChild(div);

  setTimeout(() => {
    const quill = initQuill(id, "latihan_" + id);
    if (quill && data?.description) quill.root.innerHTML = data.description;

    // Setup auto-expand for textareas in this new element
    div.querySelectorAll("textarea.file-content").forEach(function (textarea) {
      textarea.dataset.autoExpandSetup = "true";
      autoExpandTextarea(textarea);
    });
  }, 50);
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
                        <textarea class="file-content" rows="1" placeholder="Kode program..."></textarea>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="this.closest('.latihan-file-row').remove()">✕</button>
                `;
  container.appendChild(div);

  // Setup auto-expand for new textarea
  const textarea = div.querySelector("textarea.file-content");
  textarea.dataset.autoExpandSetup = "true";
  autoExpandTextarea(textarea);
}

function getLatihans() {
  const items = document.querySelectorAll("#latihanList .sub-item-form");
  const result = [];
  items.forEach((item) => {
    const title = item.querySelector(".latihan-title")?.value || "";
    const quillId = item.dataset.quillId;
    let description = "";
    if (quillId && window[quillId]) description = window[quillId].getText();
    const files = [];
    item.querySelectorAll(".latihan-file-row").forEach((el) => {
      const name = el.querySelector(".file-name")?.value;
      const content = el.querySelector(".file-content")?.value;
      if (name && content)
        files.push({ name: name.trim(), content: content.trim() });
    });
    if (files.length)
      result.push({ title, description: description.trim(), files });
  });
  return result;
}

function setLatihans(data) {
  const list = document.getElementById("latihanList");
  list.innerHTML = "";
  if (data && data.length) data.forEach((d) => addLatihanToForm(d));
}

document
  .getElementById("addLatihanBtn")
  .addEventListener("click", () => addLatihanToForm());

// ============================================================
// BREAK & FIX (modal form)
// ============================================================
function addBreakfixToForm(data = null) {
  const list = document.getElementById("breakfixList");
  const idx = list.children.length;
  const descId = "bfDesc_" + Date.now() + "_" + state.breakfixQuillIdCounter++;
  const hintId = "bfHint_" + Date.now() + "_" + state.breakfixQuillIdCounter++;
  const solId = "bfSol_" + Date.now() + "_" + state.breakfixQuillIdCounter++;
  const div = document.createElement("div");
  div.className = "sub-item-form";
  div.dataset.descId = descId;
  div.dataset.hintId = hintId;
  div.dataset.solId = solId;
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
                `;
  list.appendChild(div);

  setTimeout(() => {
    const q1 = initQuill(descId, "bfdesc_" + descId);
    if (q1 && data?.description) q1.root.innerHTML = data.description;
    const q2 = initQuill(hintId, "bfhint_" + hintId);
    if (q2 && data?.hint) q2.root.innerHTML = data.hint;
    const q3 = initQuill(solId, "bfsol_" + solId);
    if (q3 && data?.solution) q3.root.innerHTML = data.solution;

    // Setup auto-expand for textareas
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
  if (descId && window[descId]) desc = window[descId].getText();
  if (hintId && window[hintId]) hint = window[hintId].getText();
  if (solId && window[solId]) sol = window[solId].getText();

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

  document.getElementById("diffBody").innerHTML = `
                    <h3 style="font-size:.95rem;margin-bottom:6px;">${escapeHTML(title)}</h3>
                    ${desc ? `<div style="margin-bottom:8px;"><strong>📝 Deskripsi:</strong> ${escapeHTML(desc)}</div>` : ""}
                    <table class="diff-table">
                        <thead><tr><th>#</th><th>🔴 Broken</th><th>#</th><th>🟢 Fixed</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="diff-legend">
                        <span>🟡 Berubah</span>
                        <span>🟢 Ditambahkan</span>
                        <span>🔴 Dihapus</span>
                    </div>
                    ${hint ? `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;"><strong>💡 Hint:</strong> ${escapeHTML(hint)}</div>` : ""}
                    ${sol ? `<div><strong>✅ Solusi:</strong> ${escapeHTML(sol)}</div>` : ""}
                `;
  document.getElementById("diffModal").classList.remove("hidden");
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
    if (descId && window[descId]) description = window[descId].getText();
    if (hintId && window[hintId]) hint = window[hintId].getText();
    if (solId && window[solId]) solution = window[solId].getText();
    if (broken || fixed)
      result.push({
        title,
        description: description.trim(),
        brokenCode: broken,
        fixedCode: fixed,
        hint: hint.trim(),
        solution: solution.trim(),
        solved,
      });
  });
  return result;
}

function setBreakfixs(data) {
  const list = document.getElementById("breakfixList");
  list.innerHTML = "";
  if (data && data.length) data.forEach((d) => addBreakfixToForm(d));
}

document
  .getElementById("addBreakfixBtn")
  .addEventListener("click", () => addBreakfixToForm());

// ============================================================
// PROGRAM (modal form)
// ============================================================
function addProgramToForm(data = null) {
  const list = document.getElementById("programList");
  const idx = list.children.length;
  const id = "progDesc_" + Date.now() + "_" + state.programQuillIdCounter++;
  const div = document.createElement("div");
  div.className = "sub-item-form";
  div.dataset.quillId = id;
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
                `;
  list.appendChild(div);
  setTimeout(() => {
    const q = initQuill(id, "prog_" + id);
    if (q && data?.description) q.root.innerHTML = data.description;

    // Setup auto-expand for textarea
    const textarea = div.querySelector(".prog-code");
    textarea.dataset.autoExpandSetup = "true";
    autoExpandTextarea(textarea);
  }, 50);
}

function getPrograms() {
  const items = document.querySelectorAll("#programList .sub-item-form");
  const result = [];
  items.forEach((item) => {
    const title = item.querySelector(".prog-title")?.value || "";
    const code = item.querySelector(".prog-code")?.value || "";
    const quillId = item.dataset.quillId;
    let description = "";
    if (quillId && window[quillId]) description = window[quillId].getText();
    if (code) result.push({ title, description: description.trim(), code });
  });
  return result;
}

function setPrograms(data) {
  const list = document.getElementById("programList");
  list.innerHTML = "";
  if (data && data.length) data.forEach((d) => addProgramToForm(d));
}

document
  .getElementById("addProgramBtn")
  .addEventListener("click", () => addProgramToForm());

// ============================================================
// SAVE
// ============================================================
document.getElementById("saveNote").addEventListener("click", async () => {
  const title = document.getElementById("noteTitle").value.trim();
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
  const category = document.getElementById("noteCategory").value;
  const syntaxCode = document.getElementById("noteSyntaxCode").value;

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

// ============================================================
// EXPORT / IMPORT
// ============================================================
document.getElementById("exportBtn").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(state.notes, null, 2)]),
  );
  a.download = `catatan-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast("Ekspor berhasil");
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});
document.getElementById("fileInput").addEventListener("change", async (e) => {
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
        showToast("Import sukses");
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

// ============================================================
// FILTERS
// ============================================================
document.getElementById("categorySelect").addEventListener("change", (e) => {
  state.selectedCategory = e.target.value;
  render();
});
document
  .getElementById("understandingFilter")
  .addEventListener("change", (e) => {
    state.understandingFilter = e.target.value;
    render();
  });
document.getElementById("sortBy").addEventListener("change", (e) => {
  state.sortBy = e.target.value;
  render();
});
document.getElementById("resetFilter").addEventListener("click", () => {
  state.selectedCategory = "ALL";
  state.understandingFilter = "ALL";
  state.sortBy = "default";
  document.getElementById("categorySelect").value = "ALL";
  document.getElementById("understandingFilter").value = "ALL";
  document.getElementById("sortBy").value = "default";
  document.getElementById("searchInput").value = "";
  render();
  showToast("Filter direset");
});
document.getElementById("searchInput").addEventListener("input", render);

// ============================================================
// THEME
// ============================================================
document.getElementById("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  document.getElementById("themeToggle").textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("catatan_theme", isDark ? "dark" : "light");
});

// ============================================================
// INIT (Modified with async)
// ============================================================
async function init() {
  const savedTheme = localStorage.getItem("catatan_theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    document.getElementById("themeToggle").textContent = "☀️";
  }

  // Setup auto-expand for all textareas
  setupAutoExpand(
    ".latihan-file-row textarea.file-content, .prog-code, .bf-broken, .bf-fixed",
  );

  // Quill
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

  // Load data dari storage (local + server)
  const loaded = await loadFromStorage();

  if (!loaded || !state.notes.length) {
    // Data default jika kosong
    state.notes = [
      {
        id: 0,
        title: "Belajar React Hooks",
        category: "React",
        understanding: "belum",
        fundamentalType: "fundamental",
        syntaxCode: "useState(initialState)",
        understand: "<p><strong>useState</strong> untuk state management</p>",
        notUnderstand: "<p>useEffect dependency array</p>",
        commonMistakes: "<p>Lupa menambahkan dependency</p>",
        latihans: [
          {
            title: "Todo App",
            description: "Buat todo dengan hooks",
            files: [
              {
                name: "App.js",
                content: "function App() { return <div>Todo</div> }",
              },
            ],
          },
        ],
        breakfixs: [
          {
            title: "UseEffect Loop",
            description: "Infinite loop",
            brokenCode: "useEffect(() => { setCount(count+1) })",
            fixedCode: "useEffect(() => { setCount(count+1) }, [])",
            solved: true,
          },
        ],
        programs: [
          {
            title: "Counter",
            description: "Counter dengan useState",
            code: "const [count, setCount] = useState(0)",
          },
        ],
        created: new Date().toLocaleDateString("id-ID"),
        edited: new Date().toLocaleDateString("id-ID"),
        pin: false,
        favorite: false,
      },
      {
        id: 1,
        title: "CSS Flexbox vs Grid",
        category: "CSS",
        understanding: "paham",
        fundamentalType: "fundamental",
        syntaxCode: "display: flex;\ndisplay: grid;",
        understand: "<p>Flexbox untuk 1D layout</p><p>Grid untuk 2D layout</p>",
        notUnderstand: "",
        commonMistakes: "<p>Lupa memberikan width pada flex items</p>",
        latihans: [],
        breakfixs: [],
        programs: [
          {
            title: "Flex Layout",
            description: "Layout dengan flex",
            code: ".container { display: flex; gap: 16px; }",
          },
        ],
        created: new Date().toLocaleDateString("id-ID"),
        edited: new Date().toLocaleDateString("id-ID"),
        pin: true,
        favorite: true,
      },
      {
        id: 2,
        title: "JavaScript Async/Await",
        category: "JavaScript",
        understanding: "belum",
        fundamentalType: "fundamental",
        syntaxCode:
          "async function fetchData() { const res = await fetch(url); }",
        understand: "<p>async/await untuk handling promise</p>",
        notUnderstand: "<p>Error handling dengan try/catch</p>",
        commonMistakes: "<p>Lupa menggunakan await</p>",
        latihans: [],
        breakfixs: [
          {
            title: "Promise Error",
            description: "Error handling",
            brokenCode: "fetch(url).then(res => res.json())",
            fixedCode:
              "try { const res = await fetch(url) } catch(err) { console.log(err) }",
            solved: false,
          },
        ],
        programs: [],
        created: new Date().toLocaleDateString("id-ID"),
        edited: new Date().toLocaleDateString("id-ID"),
        pin: false,
        favorite: false,
      },
    ];
    await saveToStorage();
  }

  render();
  updateSyncStatus("💾 Tersimpan");
  console.log("✅ CatatanKu — Satu Halaman Satu Catatan siap");
  console.log("⌨️ Gunakan tombol ◀ ▶ atau panah kiri/kanan untuk navigasi");
}

// Update DOMContentLoaded untuk async init
document.addEventListener("DOMContentLoaded", () => {
  init();
});
