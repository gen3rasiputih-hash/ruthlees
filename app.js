(() => {
  "use strict";

  const STATUS = {
    reading: { label: "Sedang dibaca", className: "status-reading" },
    completed: { label: "Selesai", className: "status-completed" },
    on_hold: { label: "Ditunda", className: "status-on-hold" },
    dropped: { label: "Ditinggalkan", className: "status-dropped" },
    plan_to_read: { label: "Rencana baca", className: "status-plan" }
  };

  const $ = (selector) => document.querySelector(selector);
  const authView = $("#authView");
  const appView = $("#appView");
  const loginForm = $("#loginForm");
  const loginButton = $("#loginButton");
  const loginMessage = $("#loginMessage");
  const manhwaModal = $("#manhwaModal");
  const manhwaForm = $("#manhwaForm");
  const formMessage = $("#formMessage");
  const saveButton = $("#saveButton");
  const manhwaGrid = $("#manhwaGrid");
  const loadingState = $("#loadingState");
  const emptyState = $("#emptyState");
  const noResultsState = $("#noResultsState");
  const errorState = $("#errorState");
  const toast = $("#toast");

  let supabaseClient = null;
  let allManhwa = [];
  let editingId = null;
  let currentUser = null;
  let toastTimeout = null;

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  function showMessage(element, message, type = "error") {
    element.textContent = message;
    element.className = `form-message ${type === "success" ? "success-message" : "error-message"}`;
  }

  function clearMessage(element) {
    element.textContent = "";
    element.className = "form-message";
  }

  function showToast(message, type = "success") {
    toast.textContent = message;
    toast.className = `toast toast-visible ${type === "error" ? "toast-error" : ""}`;
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => {
      toast.className = "toast";
    }, 3200);
  }

  function setHidden(element, hidden) {
    element.classList.toggle("hidden", hidden);
  }

  function setAuthBusy(busy) {
    loginButton.disabled = busy;
    loginButton.innerHTML = busy ? '<span class="spinner spinner-light"></span> Memeriksa...' : 'Masuk <span aria-hidden="true">↗</span>';
  }

  function isValidHttpUrl(value) {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch (_error) {
      return false;
    }
  }

  function safeExternalUrl(value) {
    if (!value) return "";
    try {
      const parsed = new URL(value);
      return (parsed.protocol === "https:" || parsed.protocol === "http:") ? parsed.href : "";
    } catch (_error) {
      return "";
    }
  }

  function displayNumber(value) {
    if (value === null || value === undefined || value === "") return "0";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Number(value));
  }

  function setWorkspaceVisible(isVisible) {
    setHidden(authView, isVisible);
    setHidden(appView, !isVisible);
  }

  function setUserDetails(user) {
    const email = user?.email || "Akun pribadi";
    $("#userEmail").textContent = email;
    $("#userInitial").textContent = email.trim().charAt(0).toUpperCase() || "R";
  }

  async function loadManhwa() {
    if (!supabaseClient || !currentUser) return;
    setHidden(loadingState, false);
    setHidden(errorState, true);
    setHidden(emptyState, true);
    setHidden(noResultsState, true);
    manhwaGrid.replaceChildren();

    const { data, error } = await supabaseClient
      .from("manhwa")
      .select("id,title,cover_url,reading_url,current_chapter,total_chapters,status,rating,notes,created_at,updated_at")
      .order("created_at", { ascending: false });

    setHidden(loadingState, true);
    if (error) {
      errorState.textContent = `Koleksi belum dapat dimuat: ${error.message}. Periksa koneksi dan policy database.`;
      setHidden(errorState, false);
      updateStats([]);
      return;
    }

    allManhwa = Array.isArray(data) ? data : [];
    updateStats(allManhwa);
    renderManhwa();
  }

  function updateStats(items) {
    $("#totalCount").textContent = displayNumber(items.length);
    $("#readingCount").textContent = displayNumber(items.filter((item) => item.status === "reading").length);
    $("#completedCount").textContent = displayNumber(items.filter((item) => item.status === "completed").length);
    $("#planCount").textContent = displayNumber(items.filter((item) => item.status === "plan_to_read").length);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createCard(item) {
    const card = createElement("article", "manhwa-card");
    const coverWrap = createElement("div", "cover-wrap");
    const coverUrl = safeExternalUrl(item.cover_url);

    if (coverUrl) {
      const image = document.createElement("img");
      image.className = "cover-image";
      image.src = coverUrl;
      image.alt = `Cover ${item.title}`;
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        image.remove();
        coverWrap.append(createElement("div", "cover-fallback", "R"));
      }, { once: true });
      coverWrap.append(image);
    } else {
      coverWrap.append(createElement("div", "cover-fallback", "R"));
    }

    const status = STATUS[item.status] || STATUS.reading;
    const statusBadge = createElement("span", `status-badge ${status.className}`, status.label);
    coverWrap.append(statusBadge);

    const cardBody = createElement("div", "card-body");
    const title = createElement("h3", "card-title", item.title || "Tanpa judul");
    const progressLine = createElement("div", "chapter-line");
    const chapterText = createElement("span", "chapter-label", `Chapter ${displayNumber(item.current_chapter)}`);
    const totalText = createElement("span", "chapter-total", item.total_chapters !== null && item.total_chapters !== "" ? `/ ${displayNumber(item.total_chapters)}` : "");
    progressLine.append(chapterText, totalText);

    const cardMeta = createElement("div", "card-meta");
    if (item.rating !== null && item.rating !== undefined) {
      const rating = createElement("span", "rating-pill", `★ ${item.rating}/10`);
      cardMeta.append(rating);
    }
    if (item.reading_url && safeExternalUrl(item.reading_url)) {
      const readLink = document.createElement("a");
      readLink.className = "read-link";
      readLink.href = safeExternalUrl(item.reading_url);
      readLink.target = "_blank";
      readLink.rel = "noopener noreferrer";
      readLink.textContent = "Buka bacaan ↗";
      cardMeta.append(readLink);
    }

    const actions = createElement("div", "card-actions");
    const incrementButton = createElement("button", "small-action chapter-action", "+1 chapter");
    incrementButton.type = "button";
    incrementButton.dataset.action = "increment";
    incrementButton.dataset.id = item.id;
    incrementButton.setAttribute("aria-label", `Tambah satu chapter untuk ${item.title}`);
    const editButton = createElement("button", "small-action", "Edit");
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.dataset.id = item.id;
    const deleteButton = createElement("button", "small-action delete-action", "Hapus");
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = item.id;
    actions.append(incrementButton, editButton, deleteButton);

    cardBody.append(title, progressLine);
    if (item.notes) cardBody.append(createElement("p", "card-notes", item.notes));
    if (cardMeta.childElementCount) cardBody.append(cardMeta);
    cardBody.append(actions);
    card.append(coverWrap, cardBody);
    return card;
  }

  function renderManhwa() {
    const query = $("#searchInput").value.trim().toLocaleLowerCase("id-ID");
    const filter = $("#statusFilter").value;
    const filtered = allManhwa.filter((item) => {
      const matchesQuery = !query || `${item.title || ""} ${item.notes || ""}`.toLocaleLowerCase("id-ID").includes(query);
      const matchesStatus = filter === "all" || item.status === filter;
      return matchesQuery && matchesStatus;
    });

    $("#resultCount").textContent = `${filtered.length} judul`;
    manhwaGrid.replaceChildren();
    setHidden(emptyState, allManhwa.length !== 0 || filtered.length !== 0);
    setHidden(noResultsState, allManhwa.length === 0 || filtered.length !== 0);

    if (filtered.length) {
      const fragment = document.createDocumentFragment();
      filtered.forEach((item) => fragment.append(createCard(item)));
      manhwaGrid.append(fragment);
    }
  }

  function openModal(item = null) {
    editingId = item?.id || null;
    manhwaForm.reset();
    clearMessage(formMessage);
    $("#modalTitle").textContent = item ? "Edit manhwa" : "Tambah manhwa";
    saveButton.textContent = item ? "Simpan perubahan" : "Simpan manhwa";
    $("#titleInput").value = item?.title || "";
    $("#coverInput").value = item?.cover_url || "";
    $("#readingUrlInput").value = item?.reading_url || "";
    $("#chapterInput").value = item?.current_chapter ?? 0;
    $("#totalChapterInput").value = item?.total_chapters ?? "";
    $("#statusInput").value = item?.status || "reading";
    $("#ratingInput").value = item?.rating ?? "";
    $("#notesInput").value = item?.notes || "";
    setHidden(manhwaModal, false);
    document.body.classList.add("modal-open");
    window.setTimeout(() => $("#titleInput").focus(), 40);
  }

  function closeModal() {
    setHidden(manhwaModal, true);
    document.body.classList.remove("modal-open");
    editingId = null;
  }

  async function saveManhwa(event) {
    event.preventDefault();
    clearMessage(formMessage);
    if (!supabaseClient || !currentUser) return;

    const title = $("#titleInput").value.trim();
    const coverUrl = $("#coverInput").value.trim();
    const readingUrl = $("#readingUrlInput").value.trim();
    const currentChapter = $("#chapterInput").value === "" ? 0 : Number($("#chapterInput").value);
    const totalChapterValue = $("#totalChapterInput").value;
    const ratingValue = $("#ratingInput").value;

    if (!title) {
      showMessage(formMessage, "Judul manhwa wajib diisi.");
      return;
    }
    if (!isValidHttpUrl(coverUrl) || !isValidHttpUrl(readingUrl)) {
      showMessage(formMessage, "URL harus diawali http:// atau https://.");
      return;
    }
    if (!Number.isFinite(currentChapter) || currentChapter < 0) {
      showMessage(formMessage, "Chapter terakhir harus berupa angka 0 atau lebih.");
      return;
    }
    if (totalChapterValue !== "" && (!Number.isFinite(Number(totalChapterValue)) || Number(totalChapterValue) < 0)) {
      showMessage(formMessage, "Total chapter harus berupa angka 0 atau lebih.");
      return;
    }

    const payload = {
      title,
      cover_url: coverUrl || null,
      reading_url: readingUrl || null,
      current_chapter: currentChapter,
      total_chapters: totalChapterValue === "" ? null : Number(totalChapterValue),
      status: $("#statusInput").value,
      rating: ratingValue === "" ? null : Number(ratingValue),
      notes: $("#notesInput").value.trim() || null,
      updated_at: new Date().toISOString()
    };

    const wasEditing = Boolean(editingId);
    saveButton.disabled = true;
    saveButton.textContent = "Menyimpan...";
    const request = editingId
      ? supabaseClient.from("manhwa").update(payload).eq("id", editingId).select().single()
      : supabaseClient.from("manhwa").insert(payload).select().single();
    const { error } = await request;
    saveButton.disabled = false;
    saveButton.textContent = editingId ? "Simpan perubahan" : "Simpan manhwa";

    if (error) {
      showMessage(formMessage, `Gagal menyimpan: ${error.message}`);
      return;
    }

    closeModal();
    showToast(wasEditing ? "Perubahan berhasil disimpan." : "Manhwa berhasil ditambahkan.");
    await loadManhwa();
  }

  async function deleteManhwa(id) {
    const item = allManhwa.find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm(`Hapus "${item.title}" dari koleksi RUTHLEES?`)) return;

    const { error } = await supabaseClient.from("manhwa").delete().eq("id", id);
    if (error) {
      showToast(`Gagal menghapus: ${error.message}`, "error");
      return;
    }
    showToast("Manhwa berhasil dihapus.");
    await loadManhwa();
  }

  async function incrementChapter(id) {
    const item = allManhwa.find((entry) => entry.id === id);
    if (!item) return;
    const nextChapter = Number(item.current_chapter || 0) + 1;
    const { error } = await supabaseClient
      .from("manhwa")
      .update({ current_chapter: nextChapter, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      showToast(`Chapter gagal diperbarui: ${error.message}`, "error");
      return;
    }
    showToast(`Progres diperbarui ke chapter ${displayNumber(nextChapter)}.`);
    await loadManhwa();
  }

  async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) showToast(`Gagal keluar: ${error.message}`, "error");
  }

  function initializeEvents() {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearMessage(loginMessage);
      if (!supabaseClient) {
        showMessage(loginMessage, "Konfigurasi Supabase belum diisi. Periksa file config.js.");
        return;
      }
      const email = $("#loginEmail").value.trim();
      const password = $("#loginPassword").value;
      setAuthBusy(true);
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      setAuthBusy(false);
      if (error) showMessage(loginMessage, `Login gagal: ${error.message}`);
      else loginForm.reset();
    });

    $("#logoutButton").addEventListener("click", logout);
    $("#addButton").addEventListener("click", () => openModal());
    $("#closeModalButton").addEventListener("click", closeModal);
    $("#cancelModalButton").addEventListener("click", closeModal);
    $("#searchInput").addEventListener("input", renderManhwa);
    $("#statusFilter").addEventListener("change", renderManhwa);
    manhwaForm.addEventListener("submit", saveManhwa);

    document.querySelectorAll('[data-action="add"]').forEach((button) => button.addEventListener("click", () => openModal()));

    manhwaGrid.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const { action, id } = button.dataset;
      if (action === "edit") {
        const item = allManhwa.find((entry) => entry.id === id);
        if (item) openModal(item);
      } else if (action === "delete") {
        deleteManhwa(id);
      } else if (action === "increment") {
        incrementChapter(id);
      }
    });

    manhwaModal.addEventListener("click", (event) => {
      if (event.target === manhwaModal) closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !manhwaModal.classList.contains("hidden")) closeModal();
    });
  }

  function initializeSupabase() {
    const config = window.RUTHLEES_CONFIG || {};
    const url = (config.supabaseUrl || "").trim();
    const key = (config.supabaseKey || "").trim();
    const validConfig = url.startsWith("https://") && key && !key.includes("ISI_") && !url.includes("ISI_");

    if (!validConfig || !window.supabase?.createClient) {
      showMessage(loginMessage, "Website belum terhubung ke Supabase. Isi Project URL dan Publishable Key di file config.js, lalu muat ulang halaman.");
      loginButton.disabled = true;
      loginButton.innerHTML = "Konfigurasi belum lengkap";
      return;
    }

    supabaseClient = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      if (currentUser) {
        setUserDetails(currentUser);
        setWorkspaceVisible(true);
        window.setTimeout(() => loadManhwa(), 0);
      } else {
        allManhwa = [];
        manhwaGrid.replaceChildren();
        setWorkspaceVisible(false);
      }
    });
  }

  initializeEvents();
  initializeSupabase();
})();
