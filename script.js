(function () {
    let notes = [];
    let selectedCategory = "ALL",
        understandingFilter = "ALL",
        sortBy = "default",
        editingIndex = null;
    let autoSaveTimeout = null;
    let currentViewIndex = 0;
    let touchStartX = 0;
    let touchEndX = 0;
    let savedScrollY = 0;

    const SERVER_URL = "http://localhost/note/";
    const DATA_URL = `${SERVER_URL}/data.json`,
        SAVE_URL = `${SERVER_URL}/save-data.php`;

    const els = {
        notesGrid: document.getElementById("notesGrid"),
        searchInput: document.getElementById("searchInput"),
        categorySelect: document.getElementById("categorySelect"),
        understandingFilter: document.getElementById("understandingFilter"),
        sortBySelect: document.getElementById("sortBy"),
        selectedCategoryLabel: document.getElementById("selectedCategoryLabel"),
        totalNotes: document.getElementById("totalNotes"),
        pinnedNotes: document.getElementById("pinnedNotes"),
        streakCount: document.getElementById("streakCount"),
        comprehensionPercent: document.getElementById("comprehensionPercent"),
        resetFilter: document.getElementById("resetFilter"),
        themeToggle: document.getElementById("themeToggle"),
        addNoteBtn: document.getElementById("addNoteBtn"),
        editModal: document.getElementById("editModal"),
        viewModal: document.getElementById("viewModal"),
        noteTitle: document.getElementById("noteTitle"),
        noteCategory: document.getElementById("noteCategory"),
        noteDeadline: document.getElementById("noteDeadline"),
        noteUnderstand: document.getElementById("noteUnderstand"),
        noteNotUnderstand: document.getElementById("noteNotUnderstand"),
        noteLatihan: document.getElementById("noteLatihan"),
        noteProgramCode: document.getElementById("noteProgramCode"),
        noteSyntaxCode: document.getElementById("noteSyntaxCode"),
        noteKeywords: document.getElementById("noteKeywords"),
        cancelEdit: document.getElementById("cancelEdit"),
        saveNote: document.getElementById("saveNote"),
        exportBtn: document.getElementById("exportBtn"),
        importBtn: document.getElementById("importBtn"),
        manualSaveBtn: document.getElementById("manualSaveBtn"),
        loadFromServerBtn: document.getElementById("loadFromServerBtn"),
        fileInput: document.getElementById("fileInput"),
        syncStatus: document.getElementById("syncStatus"),
        autoSaveIndicator: document.getElementById("autoSaveIndicator"),
        prevNoteBtn: document.getElementById("prevNoteBtn"),
        nextNoteBtn: document.getElementById("nextNoteBtn"),
        livePreviewModal: document.getElementById("livePreviewModal"),
        previewIframe: document.getElementById("previewIframe"),
        closePreviewBtn: document.getElementById("closePreviewBtn"),
        modalContainerSwipe: document.getElementById("modalContainerSwipe"),
    };

    const understandingRadios = document.querySelectorAll('input[name="understanding"]');
    const fundamentalRadios = document.querySelectorAll('input[name="fundamentalType"]');

    function lockBodyScroll() {
        savedScrollY = window.scrollY;
        document.body.classList.add("modal-open");
        document.body.style.setProperty("--scroll-top", `-${savedScrollY}px`);
    }

    function unlockBodyScroll() {
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("--scroll-top");
        window.scrollTo(0, savedScrollY);
    }

    function closeAllModals() {
        let closed = false;
        if (!els.editModal.classList.contains("hidden")) {
            els.editModal.classList.add("hidden");
            closed = true;
        }
        if (!els.viewModal.classList.contains("hidden")) {
            els.viewModal.classList.add("hidden");
            closed = true;
        }
        if (!els.livePreviewModal.classList.contains("hidden")) {
            els.livePreviewModal.classList.add("hidden");
            if (els.previewIframe) els.previewIframe.src = "about:blank";
            closed = true;
        }
        if (closed) {
            unlockBodyScroll();
            showToast("Modal ditutup", false);
        }
        return closed;
    }

    window.addEventListener("popstate", function (event) {
        if (closeAllModals()) {
            history.pushState(null, null, window.location.href);
            event.preventDefault();
        }
    });

    history.pushState(null, null, window.location.href);

    function showToast(m, err = false) {
        let t = document.createElement("div");
        t.className = "toast";
        t.textContent = m;
        if (err) t.classList.add("error");
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }

    function escapeHTML(s) {
        return s ? s.replace(/[&<>]/g, (m) =>
            m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;"
        ) : "";
    }

    function highlightText(t, k) {
        if (!k || !t) return escapeHTML(t);
        let r = new RegExp(`(${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
        return escapeHTML(t).replace(r, '<span class="highlight">$1</span>');
    }

    function isDeadlineSoon(d) {
        if (!d) return false;
        let diff = new Date(d) - new Date();
        return diff > 0 && diff < 86400000;
    }

    function showLivePreview(code) {
        if (!code || !code.trim()) {
            showToast("Tidak ada kode program untuk ditampilkan", true);
            return;
        }
        let htmlContent = code;
        if (!/<!DOCTYPE|<html|<body/i.test(code)) {
            htmlContent = `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>\n<body>\n${code}\n</body>\n</html>`;
        }
        const blob = new Blob([htmlContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        els.previewIframe.src = url;
        els.livePreviewModal.classList.remove("hidden");
        lockBodyScroll();
        history.pushState(null, null, window.location.href);
        els.previewIframe.onload = () => URL.revokeObjectURL(url);
    }

    function formatProgramCodeBlock(code, noteId) {
        if (!code || !code.trim())
            return '<div style="padding:1rem;text-align:center;opacity:0.6;">📄 Tidak ada contoh program</div>';
        let trimmed = code.trimEnd();

        return `
            <div class="code-section">
                <div class="code-header">
                    <span></span>
                    <div style="display:flex; gap:8px;">
                        <button class="copy-code-btn" onclick="copyFormattedCode(this)">📋 Salin Kode</button>
                        <button class="copy-code-btn preview-btn" onclick="window.previewCodeFromNote(${noteId})">🎬 Preview Program</button>
                    </div>
                </div>
                <pre><code>${escapeHTML(trimmed)}</code></pre>
            </div>
        `;
    }

    function formatSyntaxCodeBlock(code, noteId) {
        if (!code || !code.trim())
            return '<div style="padding:1rem;text-align:center;opacity:0.6;">📝 Tidak ada contoh syntax</div>';
        let trimmed = code.trimEnd();

        return `
            <div class="code-section">
                <div class="code-header">
                    <span></span>
                    <div style="display:flex; gap:8px;">
                        <button class="copy-code-btn" onclick="copyFormattedCode(this)">📋 Salin Kode</button>
                    </div>
                </div>
                <pre><code>${escapeHTML(trimmed)}</code></pre>
            </div>
        `;
    }

    window.copyFormattedCode = function (btn) {
        const pre = btn.closest(".code-section").querySelector("pre code");
        if (pre) {
            let rawCode = pre.innerText;
            navigator.clipboard.writeText(rawCode).then(() => {
                btn.textContent = "✅ Tersalin!";
                setTimeout(() => (btn.textContent = btn.textContent.includes("Program") ? "📋 Salin Kode" : "📋 Salin Syntax"), 1500);
            }).catch(() => showToast("Gagal menyalin", true));
        }
    };

    window.previewCodeFromNote = function (noteId) {
        const note = notes[noteId];
        if (note && note.programCode) showLivePreview(note.programCode);
        else showToast("Tidak ada program untuk ditampilkan", true);
    };

    function updateSyncStatus(st, msg) {
        els.syncStatus.textContent = msg || st;
        els.syncStatus.className = "sync-status";
        if (st === "synced") {
            els.syncStatus.classList.add("synced");
            els.autoSaveIndicator.style.background = "#10b981";
            els.autoSaveIndicator.textContent = "✓ Tersimpan";
            setTimeout(() => {
                if (els.autoSaveIndicator.textContent === "✓ Tersimpan") {
                    els.autoSaveIndicator.style.background = "#e2e8f0";
                    els.autoSaveIndicator.textContent = "💾 Auto-Save";
                }
            }, 2000);
        } else if (st === "syncing") {
            els.autoSaveIndicator.style.background = "#f59e0b";
            els.autoSaveIndicator.textContent = "💿 Menyimpan...";
        } else if (st === "error") {
            els.autoSaveIndicator.style.background = "#ef4444";
            els.autoSaveIndicator.textContent = "⚠️ Gagal";
            setTimeout(() => {
                if (els.autoSaveIndicator.textContent === "⚠️ Gagal") {
                    els.autoSaveIndicator.style.background = "#e2e8f0";
                    els.autoSaveIndicator.textContent = "💾 Auto-Save";
                }
            }, 3000);
        }
    }

    async function saveToServer() {
        try {
            updateSyncStatus("syncing");
            let res = await fetch(SAVE_URL + "?_cb=" + Date.now(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: notes,
                    timestamp: new Date().toISOString(),
                }),
            });
            if (!res.ok) throw new Error();
            let json = await res.json();
            if (json.success) {
                showToast("✅ Tersimpan ke server");
                updateSyncStatus("synced");
                return true;
            }
            throw new Error();
        } catch (e) {
            showToast("❌ Gagal simpan server", true);
            updateSyncStatus("error");
            return false;
        }
    }

    function autoSave() {
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => saveToServer(), 1200);
    }

    function saveToStorage() {
        localStorage.setItem("notes", JSON.stringify(notes));
        autoSave();
    }

    async function loadFromServer() {
        try {
            updateSyncStatus("syncing", "☁️ Memuat...");
            let res = await fetch(DATA_URL + "?_cb=" + Date.now(), {
                cache: "no-cache",
            });

            if (!res.ok) throw new Error();
            let data = await res.json();

            if (Array.isArray(data) && data.length) {
                notes = data.map((n, idx) => ({
                    ...n,
                    id: idx,
                    understand: n.understand || "",
                    notUnderstand: n.notUnderstand || "",
                    latihan: n.latihan || "",
                    programCode: n.programCode || "",
                    syntaxCode: n.syntaxCode || "",
                    keywords: n.keywords || "",
                    category: n.category || "Umum",
                    understanding: n.understanding || "belum",
                    fundamentalType: n.fundamentalType || "nonfundamental",
                    pin: n.pin || false,
                    favorite: n.favorite || false,
                    deadline: n.deadline || null,
                    created: n.created || new Date().toLocaleDateString("id-ID"),
                    edited: n.edited || new Date().toLocaleDateString("id-ID"),
                }));

                saveToStorage();
                updateCategoryDropdown();
                renderNotes();
                showToast(`✅ ${notes.length} catatan dimuat dari server`);
                updateSyncStatus("synced");

                return true;
            } else {
                showToast("Server kosong, mulai catatan baru", false);
                return false;
            }

        } catch (e) {
            showToast("Gagal muat dari server", true);
            updateSyncStatus("error");
            return false;
        }
    }

    function getCategoryCount() {
        let m = new Map();
        notes.forEach((n) => {
            let c = n.category || "Umum";
            m.set(c, (m.get(c) || 0) + 1);
        });
        return m;
    }

    function updateCategoryDropdown() {
        let cats = getCategoryCount();
        let opts = '<option value="ALL">📂 Semua Kategori</option>';

        [...cats.keys()].sort().forEach(
            (c) => (opts += `<option value="${c}">${c} (${cats.get(c)})</option>`)
        );

        els.categorySelect.innerHTML = opts;
        if (selectedCategory !== "ALL") els.categorySelect.value = selectedCategory;
        els.selectedCategoryLabel.textContent =
            selectedCategory === "ALL" ? "Semua Kategori" : selectedCategory;
    }

    function updateStats() {
        let filtered = notes.filter(
            (n) => selectedCategory === "ALL" ||
                (n.category || "Umum") === selectedCategory
        );
        els.totalNotes.textContent = filtered.length;
        els.pinnedNotes.textContent = filtered.filter((n) => n.pin).length;
        let streak = [...new Set(notes.map((n) => n.created).filter(Boolean))].length;
        els.streakCount.textContent = streak;

        let paham = filtered.filter((n) => n.understanding === "paham").length;
        els.comprehensionPercent.textContent =
            filtered.length === 0 ? "0%" : Math.round((paham / filtered.length) * 100) + "%";
    }

    function sortNotes(arr) {
        if (sortBy === "newest")
            return [...arr].sort((a, b) => new Date(b.created) - new Date(a.created));
        if (sortBy === "oldest")
            return [...arr].sort((a, b) => new Date(a.created) - new Date(b.created));
        if (sortBy === "title")
            return [...arr].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        return [...arr].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
    }

    function getFilteredSortedNotes() {
        let kw = els.searchInput.value.toLowerCase().trim();

        let filtered = notes.filter(
            (n) => (selectedCategory === "ALL" || (n.category || "Umum") === selectedCategory) &&
                (understandingFilter === "ALL" || n.understanding === understandingFilter) &&
                (!kw ||
                    n.title?.toLowerCase().includes(kw) ||
                    n.understand?.toLowerCase().includes(kw) ||
                    n.notUnderstand?.toLowerCase().includes(kw) ||
                    n.latihan?.toLowerCase().includes(kw) ||
                    n.keywords?.toLowerCase().includes(kw) ||
                    n.programCode?.toLowerCase().includes(kw) ||
                    n.syntaxCode?.toLowerCase().includes(kw))
        );

        return sortNotes(filtered);
    }

    window.toggleFavorite = (idx) => {
        notes[idx].favorite = !notes[idx].favorite;
        saveToStorage();
        renderNotes();
        showToast(
            notes[idx].favorite ? "⭐ Favorit ditambahkan" : "☆ Favorit dihapus"
        );
    };

    window.togglePin = (idx) => {
        notes[idx].pin = !notes[idx].pin;
        saveToStorage();
        renderNotes();
        showToast(notes[idx].pin ? "📌 Catatan disemat" : "📍 Sematan dicabut");
    };

    function renderDetailViewByIndex(index) {
        const filteredNotes = getFilteredSortedNotes();
        if (index < 0 || index >= filteredNotes.length) return;
        const note = filteredNotes[index];
        const originalIdx = notes.findIndex((n) => n === note);
        if (originalIdx === -1) return;
        currentViewIndex = index;
        const n = note;
        const deadlineText = n.deadline
            ? `⏰ Deadline: ${new Date(n.deadline).toLocaleString()}`
            : "Tidak ada deadline";
        const understandText =
            n.understanding === "paham" ? "✅ Paham" : "❌ Belum Paham";
        const programHtml = formatProgramCodeBlock(n.programCode, originalIdx);
        const syntaxHtml = formatSyntaxCodeBlock(n.syntaxCode, originalIdx);

        document.getElementById("noteDetailView").innerHTML = `
            <div style="margin-bottom:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <h2 style="font-size:1.5rem;">${escapeHTML(n.title)}</h2>
                    <span class="category-badge">${escapeHTML(n.category || "Umum")}</span>
                    ${n.favorite ? '<span class="category-badge" style="background:#fbbf24;">⭐ Favorit</span>' : ""}
                </div>
            </div>
            <div class="view-meta">
                <div><div class="meta-key">Dibuat</div><div class="meta-value">${n.created || "-"}</div></div>
                <div><div class="meta-key">Diedit</div><div class="meta-value">${n.edited || "-"}</div></div>
                <div><div class="meta-key">Pemahaman</div><div class="meta-value">${understandText}</div></div>
                <div><div class="meta-key">Jenis</div><div class="meta-value">${n.fundamentalType === "fundamental" ? "⭐ Fundamental" : "📘 Non-Fundamental"}</div></div>
                <div><div class="meta-key">Deadline</div><div class="meta-value">${deadlineText}</div></div>
            </div>
            <div class="understanding-box">
                <div class="understanding-item"><strong>✅ Yang dipahami</strong><div style="white-space:pre-line; text-align: justify;">${escapeHTML(n.understand || "-")}</div></div>
                <div class="understanding-item"><strong>❌ Yang tidak dipahami</strong><div style="white-space:pre-line; text-align: justify;">${escapeHTML(n.notUnderstand || "-")}</div></div>
            </div>
            ${n.latihan ? `<div class="latihan-box"><strong>🏋️ Latihan / Tugas</strong><div style="white-space:pre-line;">${escapeHTML(n.latihan)}</div></div>` : ""}
            <div style="margin-top:1rem;"><strong>📝 Contoh Syntax / Potongan Kode</strong> ${syntaxHtml}</div>
            <div><strong>💻 Contoh Program</strong> ${programHtml}</div>
            ${n.keywords ? `<div style="background:#f1f5f9; border-radius:12px; padding:0.8rem; margin-top:0.8rem;"><strong>🏷️ Kata Kunci:</strong> ${escapeHTML(n.keywords)}</div>` : ""}
            <div class="modal-actions">
                <button class="btn-action btn-cancel" onclick="closeView()">Tutup</button>
                <button class="btn-action btn-save" onclick="editNoteFromView(${originalIdx})">Edit</button>
                <button class="btn-action btn-danger" onclick="deleteNoteFromView(${originalIdx})">Hapus</button>
            </div>
        `;
        if (els.prevNoteBtn) els.prevNoteBtn.disabled = currentViewIndex === 0;
        if (els.nextNoteBtn)
            els.nextNoteBtn.disabled = currentViewIndex === filteredNotes.length - 1;
    }

    function navigatePrev() {
        if (currentViewIndex > 0) renderDetailViewByIndex(currentViewIndex - 1);
    }

    function navigateNext() {
        const filtered = getFilteredSortedNotes();
        if (currentViewIndex < filtered.length - 1)
            renderDetailViewByIndex(currentViewIndex + 1);
    }

    function initSwipe() {
        const modalContentDiv = document.getElementById("viewModalContent");
        if (!modalContentDiv) return;
        modalContentDiv.addEventListener(
            "touchstart",
            (e) => {
                touchStartX = e.changedTouches[0].screenX;
            },
            { passive: true }
        );
        modalContentDiv.addEventListener("touchend", (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const delta = touchEndX - touchStartX;
            if (Math.abs(delta) > 60) {
                if (delta > 0) navigatePrev();
                else navigateNext();
                e.preventDefault();
            }
        });
    }

    function openNoteFromCard(originalIdx) {
        const filteredNotes = getFilteredSortedNotes();
        const targetNote = notes[originalIdx];
        const position = filteredNotes.findIndex((n) => n === targetNote);
        if (position !== -1) renderDetailViewByIndex(position);
        else renderDetailViewByIndex(0);
        els.viewModal.classList.remove("hidden");
        lockBodyScroll();
        history.pushState(null, null, window.location.href);
        initSwipe();
    }

    window.editNoteFromView = function (originalIdx) {
        editNote(originalIdx);
    };

    window.deleteNoteFromView = function (originalIdx) {
        if (confirm("Yakin hapus catatan ini?")) {
            notes.splice(originalIdx, 1);
            saveToStorage();
            if (
                selectedCategory !== "ALL" &&
                !notes.some((n) => (n.category || "Umum") === selectedCategory)
            )
                selectedCategory = "ALL";
            updateCategoryDropdown();
            renderNotes();
            els.viewModal.classList.add("hidden");
            unlockBodyScroll();
            showToast("Catatan terhapus");
        }
    };

    window.editNote = function (idx) {
        let n = notes[idx];
        editingIndex = idx;
        els.noteTitle.value = n.title || "";
        els.noteCategory.value = n.category || "";
        els.noteDeadline.value = n.deadline || "";
        els.noteUnderstand.value = n.understand || "";
        els.noteNotUnderstand.value = n.notUnderstand || "";
        els.noteLatihan.value = n.latihan || "";
        els.noteProgramCode.value = n.programCode || "";
        els.noteSyntaxCode.value = n.syntaxCode || "";
        els.noteKeywords.value = n.keywords || "";
        understandingRadios.forEach(
            (r) => (r.checked = r.value === (n.understanding || "belum"))
        );
        fundamentalRadios.forEach(
            (r) => (r.checked = r.value === (n.fundamentalType || "nonfundamental"))
        );
        document.getElementById("modalTitle").textContent = "Edit Catatan";
        els.viewModal.classList.add("hidden");
        els.editModal.classList.remove("hidden");
        lockBodyScroll();
        history.pushState(null, null, window.location.href);
    };

    window.closeView = function () {
        els.viewModal.classList.add("hidden");
        unlockBodyScroll();
    };

    function renderNotes() {
        if (!notes.length) {
            els.notesGrid.innerHTML = `<div class="empty-state"><div>📭</div><h3>Belum ada catatan</h3><p>Klik + Baru untuk mulai mencatat</p></div>`;
            updateStats();
            return;
        }
        let kw = els.searchInput.value.toLowerCase().trim();
        let filtered = notes.filter(
            (n) =>
                (selectedCategory === "ALL" || (n.category || "Umum") === selectedCategory) &&
                (understandingFilter === "ALL" || n.understanding === understandingFilter) &&
                (!kw ||
                    n.title?.toLowerCase().includes(kw) ||
                    n.understand?.toLowerCase().includes(kw) ||
                    n.notUnderstand?.toLowerCase().includes(kw) ||
                    n.latihan?.toLowerCase().includes(kw) ||
                    n.keywords?.toLowerCase().includes(kw) ||
                    n.programCode?.toLowerCase().includes(kw) ||
                    n.syntaxCode?.toLowerCase().includes(kw))
        );
        filtered = sortNotes(filtered);
        if (!filtered.length) {
            els.notesGrid.innerHTML = `<div class="empty-state"><div>🔍</div><h3>Tidak ditemukan</h3></div>`;
            updateStats();
            return;
        }
        els.notesGrid.innerHTML = filtered
            .map((n) => {
                let realIdx = notes.indexOf(n);
                let preview = (
                    n.understand ||
                    n.latihan ||
                    n.programCode ||
                    n.syntaxCode ||
                    "Belum ada isi"
                ).substring(0, 85);
                return `<div class="note-card" data-id="${realIdx}">
                            <div class="note-header">
                                <span class="category-badge">${escapeHTML(n.category || "Umum")}</span>
                                <div>
                                    <span class="favorite-icon" onclick="event.stopPropagation(); window.toggleFavorite(${realIdx})">${n.favorite ? "⭐" : "☆"}</span>
                                    <span class="pin-icon" onclick="event.stopPropagation(); window.togglePin(${realIdx})">${n.pin ? "📌" : "📍"}</span>
                                </div>
                            </div>
                            <div class="note-title">${highlightText(n.title || "Tanpa Judul", kw)}</div>
                            ${isDeadlineSoon(n.deadline) ? '<div class="deadline-badge">⚠️ Deadline mendekat!</div>' : ""}
                            <div class="note-preview">📘 ${highlightText(preview, kw)}</div>
                            <div class="understanding-inline">
                                <span class="${n.understanding === "paham" ? "understand-badge" : "notunderstand-badge"}">${n.understanding === "paham" ? "✅ Paham" : "❌ Belum Paham"}</span>
                                <span class="${n.fundamentalType === "fundamental" ? "fundamental-badge" : "nonfundamental-badge"}">${n.fundamentalType === "fundamental" ? "⭐ Fundamental" : "📘 Non-Fundamental"}</span>
                            </div>
                            <div class="note-footer"><span>🕒 ${n.created || "-"}</span>${n.edited !== n.created ? "<span>✏️ diedit</span>" : ""}</div>
                        </div>`;
            })
            .join("");
        document.querySelectorAll(".note-card").forEach((c) =>
            c.addEventListener("click", (e) => {
                if (
                    !e.target.classList.contains("pin-icon") &&
                    !e.target.classList.contains("favorite-icon")
                )
                    openNoteFromCard(parseInt(c.dataset.id));
            })
        );
        updateStats();
    }

    // Event listeners
    els.addNoteBtn.addEventListener("click", () => {
        editingIndex = null;
        els.noteTitle.value = "";
        els.noteCategory.value = "";
        els.noteDeadline.value = "";
        els.noteUnderstand.value = "";
        els.noteNotUnderstand.value = "";
        els.noteLatihan.value = "";
        els.noteProgramCode.value = "";
        els.noteSyntaxCode.value = "";
        els.noteKeywords.value = "";
        understandingRadios.forEach((r) => (r.checked = r.value === "paham"));
        fundamentalRadios.forEach(
            (r) => (r.checked = r.value === "nonfundamental")
        );
        document.getElementById("modalTitle").textContent = "Tambah Catatan";
        els.editModal.classList.remove("hidden");
        lockBodyScroll();
        history.pushState(null, null, window.location.href);
    });

    els.cancelEdit.addEventListener("click", () => {
        els.editModal.classList.add("hidden");
        unlockBodyScroll();
    });

    els.saveNote.addEventListener("click", () => {
        if (!els.noteTitle.value.trim()) {
            alert("Judul wajib diisi");
            return;
        }
        let now = new Date().toLocaleDateString("id-ID");
        let understanding = [...understandingRadios].find((r) => r.checked)?.value || "belum";
        let fundamentalType = [...fundamentalRadios].find((r) => r.checked)?.value || "nonfundamental";
        let newNote = {
            title: els.noteTitle.value,
            category: els.noteCategory.value || "Umum",
            deadline: els.noteDeadline.value || null,
            understand: els.noteUnderstand.value,
            notUnderstand: els.noteNotUnderstand.value,
            latihan: els.noteLatihan.value,
            programCode: els.noteProgramCode.value,
            syntaxCode: els.noteSyntaxCode.value,
            keywords: els.noteKeywords.value,
            pin: false,
            favorite: false,
            created: now,
            edited: now,
            understanding,
            fundamentalType,
        };
        if (editingIndex !== null) {
            newNote.created = notes[editingIndex].created;
            newNote.pin = notes[editingIndex].pin;
            newNote.favorite = notes[editingIndex].favorite;
            notes[editingIndex] = newNote;
            showToast("Catatan diperbarui");
        } else {
            notes.push(newNote);
            showToast("Catatan baru ditambahkan");
        }
        saveToStorage();
        updateCategoryDropdown();
        renderNotes();
        els.editModal.classList.add("hidden");
        unlockBodyScroll();
    });

    els.categorySelect.addEventListener("change", (e) => {
        selectedCategory = e.target.value;
        els.selectedCategoryLabel.textContent =
            selectedCategory === "ALL" ? "Semua Kategori" : selectedCategory;
        renderNotes();
    });

    els.understandingFilter.addEventListener("change", (e) => {
        understandingFilter = e.target.value;
        renderNotes();
    });

    els.sortBySelect.addEventListener("change", (e) => {
        sortBy = e.target.value;
        renderNotes();
    });

    els.resetFilter.addEventListener("click", () => {
        selectedCategory = "ALL";
        understandingFilter = "ALL";
        sortBy = "default";
        els.categorySelect.value = "ALL";
        els.understandingFilter.value = "ALL";
        els.sortBySelect.value = "default";
        els.searchInput.value = "";
        els.selectedCategoryLabel.textContent = "Semua Kategori";
        renderNotes();
        showToast("Semua filter direset");
    });

    els.searchInput.addEventListener("input", renderNotes);

    els.themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark");
        els.themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
    });

    els.exportBtn.addEventListener("click", () => {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(notes, null, 2)]));
        a.download = `catatan-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        showToast("Ekspor berhasil");
    });

    els.manualSaveBtn.addEventListener("click", saveToServer);
    els.loadFromServerBtn.addEventListener("click", loadFromServer);
    els.importBtn.addEventListener("click", () => els.fileInput.click());

    els.fileInput.addEventListener("change", (e) => {
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.onload = () => {
            try {
                let imported = JSON.parse(reader.result);
                if (Array.isArray(imported)) {
                    notes = imported.map((n, idx) => ({
                        ...n,
                        id: idx,
                        understand: n.understand || "",
                        notUnderstand: n.notUnderstand || "",
                        latihan: n.latihan || "",
                        programCode: n.programCode || "",
                        syntaxCode: n.syntaxCode || "",
                        understanding: n.understanding || "belum",
                        fundamentalType: n.fundamentalType || "nonfundamental",
                        deadline: n.deadline || null,
                        favorite: n.favorite || false,
                    }));
                    saveToStorage();
                    selectedCategory = "ALL";
                    understandingFilter = "ALL";
                    sortBy = "default";
                    els.searchInput.value = "";
                    updateCategoryDropdown();
                    renderNotes();
                    showToast("Import sukses");
                } else alert("Format tidak sesuai");
            } catch (err) {
                alert("File rusak");
            }
        };
        reader.readAsText(file);
    });

    els.prevNoteBtn.addEventListener("click", navigatePrev);
    els.nextNoteBtn.addEventListener("click", navigateNext);

    els.closePreviewBtn.addEventListener("click", () => {
        els.livePreviewModal.classList.add("hidden");
        els.previewIframe.src = "about:blank";
        unlockBodyScroll();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeAllModals();
        }
        if (!els.viewModal.classList.contains("hidden")) {
            if (e.key === "ArrowLeft") navigatePrev();
            if (e.key === "ArrowRight") navigateNext();
        }
    });

    els.editModal.addEventListener("click", (e) => {
        if (e.target === els.editModal) {
            els.editModal.classList.add("hidden");
            unlockBodyScroll();
        }
    });

    els.viewModal.addEventListener("click", (e) => {
        if (e.target === els.viewModal) {
            els.viewModal.classList.add("hidden");
            unlockBodyScroll();
        }
    });

    els.livePreviewModal.addEventListener("click", (e) => {
        if (e.target === els.livePreviewModal) {
            els.livePreviewModal.classList.add("hidden");
            els.previewIframe.src = "about:blank";
            unlockBodyScroll();
        }
    });

    loadFromServer();
})();