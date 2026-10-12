const STORAGE_KEY = "lostFoundCampusReports";
const ADMIN_DATA_KEY = "lostFoundCampusAdminChanges";
const REPORTS_SYNC_KEY = "lostFoundCampusReportsSync";
const $ = (selector) => document.querySelector(selector);

const reportGrid = $("#report-grid");
const emptyState = $("#empty-state");
const searchInput = $("#search-input");
const categoryFilter = $("#category-filter");
const statusFilter = $("#status-filter");
const reportForm = $("#report-form");
const itemPhotoInput = $("#item-photo");
const itemPhotoPreview = $("#item-photo-preview");
const modal = $("#detail-modal");
const modalContent = $("#modal-content");
const toast = $("#toast");
const storageStatus = $("#storage-status");

let reports = [];
let toastTimeout;
let selectedPhoto = "";
let photoProcessing = false;

const categoryEmoji = {
  Elektronik: "🎧",
  Dokumen: "🪪",
  Tas: "👜",
  Kunci: "🔑",
  Aksesori: "👛",
  Pakaian: "🧥",
  Lainnya: "📦",
};

function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

function compressPublicPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("Pilih foto JPG, PNG, atau WebP."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Ukuran foto maksimal 8 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Berkas ini bukan gambar valid."));
      image.onload = () => {
        const scale = Math.min(1, 1600 / image.width, 1600 / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Foto tidak dapat diproses di browser ini."));
          return;
        }
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function resetPublicPhoto() {
  selectedPhoto = "";
  itemPhotoInput.value = "";
  $("#item-photo-preview-image").removeAttribute("src");
  itemPhotoPreview.classList.add("hidden");
  $("#remove-item-photo").classList.add("hidden");
  $("#item-photo-error").textContent = "";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function apiFailureMessage(error) {
  if (error instanceof TypeError || error instanceof SyntaxError) {
    return "Server penyimpanan tidak terjangkau. Jalankan node server.js, lalu buka website melalui http://localhost:3000.";
  }
  return error.message || "Server gagal menyimpan laporan.";
}

function getSavedReports() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(isValidSavedReport) : [];
  } catch (error) {
    console.warn("Data localStorage tidak dapat dibaca:", error);
    return [];
  }
}

function getAdminChanges() {
  try {
    const changes = JSON.parse(localStorage.getItem(ADMIN_DATA_KEY) || "{}");
    return {
      overrides:
        changes.overrides && typeof changes.overrides === "object"
          ? changes.overrides
          : {},
      deletedIds: Array.isArray(changes.deletedIds) ? changes.deletedIds : [],
    };
  } catch (error) {
    console.warn("Perubahan admin tidak dapat dibaca:", error);
    return { overrides: {}, deletedIds: [] };
  }
}

function applyAdminChanges(items) {
  const changes = getAdminChanges();
  const deletedIds = new Set(changes.deletedIds);
  return items
    .filter((item) => !deletedIds.has(item.id))
    .map((item) => ({
      ...item,
      ...(changes.overrides[item.id] || {}),
      source: item.source,
    }));
}

function isValidSavedReport(item) {
  return (
    item &&
    typeof item === "object" &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.category === "string" &&
    ["Hilang", "Ditemukan"].includes(item.status) &&
    typeof item.location === "string" &&
    typeof item.date === "string" &&
    typeof item.description === "string" &&
    typeof item.contact === "string"
  );
}

function saveReports() {
  try {
    // Hanya laporan buatan pengguna yang disimpan; data contoh berasal dari data.json.
    const saved = reports
      .filter((report) => report.source === "user")
      .map(({ source, ...report }) => report);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return true;
  } catch (error) {
    console.error("Laporan gagal disimpan:", error);
    showToast(
      "Penyimpanan browser tidak tersedia. Coba periksa pengaturan browser.",
    );
    return false;
  }
}

function notifyReportsChanged() {
  try {
    localStorage.setItem(REPORTS_SYNC_KEY, String(Date.now()));
  } catch (error) {
    console.warn("Tab lain tidak dapat diberi notifikasi perubahan.", error);
  }
}

async function loadReports() {
  reportGrid.innerHTML =
    '<div class="loading-message">Sedang memuat laporan...</div>';
  try {
    const response = await fetch("/api/reports", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const serverReports = await response.json();
    if (!Array.isArray(serverReports))
      throw new Error("Format data dari server tidak sesuai.");

    reports = serverReports
      .filter(isValidSavedReport)
      .map((item) => ({
        ...item,
        source:
          item.source || (item.id.startsWith("sample-") ? "sample" : "user"),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    storageStatus.textContent = "Tersimpan di server";
    renderReports();
    updateStats();
    return;
  } catch (apiError) {
    console.warn("API penyimpanan belum tersedia:", apiError);
    storageStatus.textContent = "Mode pratinjau";
  }

  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const initialData = await response.json();
    if (!Array.isArray(initialData))
      throw new Error("Format data.json tidak sesuai.");

    const savedReports = getSavedReports().map((item) => ({
      ...item,
      source: "user",
    }));
    const savedIds = new Set(savedReports.map((item) => item.id));
    const samples = initialData
      .filter(isValidSavedReport)
      .filter((item) => !savedIds.has(item.id))
      .map((item) => ({ ...item, source: "sample" }));

    reports = applyAdminChanges([...savedReports, ...samples]).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    renderReports();
    updateStats();
    showToast(
      "Mode pratinjau aktif. Jalankan node server.js agar laporan tersimpan ke folder proyek.",
    );
  } catch (error) {
    console.error("Gagal memuat data.json:", error);
    const savedReports = getSavedReports().map((item) => ({
      ...item,
      source: "user",
    }));
    reports = applyAdminChanges(savedReports);
    renderReports();
    updateStats();
    showToast(
      "Data contoh gagal dimuat. Jalankan website melalui server lokal.",
    );
  }
}

function updateStats() {
  $("#stat-total").textContent = reports.length;
  $("#stat-lost").textContent = reports.filter(
    (item) => item.status === "Hilang",
  ).length;
  $("#stat-found").textContent = reports.filter(
    (item) => item.status === "Ditemukan",
  ).length;
}

function getFilteredReports() {
  const query = searchInput.value.trim().toLocaleLowerCase("id-ID");
  const category = categoryFilter.value;
  const status = statusFilter.value;

  return reports.filter((item) => {
    const matchesQuery = item.name.toLocaleLowerCase("id-ID").includes(query);
    const matchesCategory = category === "Semua" || item.category === category;
    const matchesStatus = status === "Semua" || item.status === status;
    return matchesQuery && matchesCategory && matchesStatus;
  });
}

function createReportCard(item, index) {
  const isLost = item.status === "Hilang";
  const itemImage = item.photo
    ? `<img class="card-photo" src="${escapeHTML(item.photo)}" alt="Foto ${escapeHTML(item.name)}">`
    : `<span class="card-emoji" aria-hidden="true">${categoryEmoji[item.category] || "📦"}</span>`;
  const card = document.createElement("article");
  card.className = `report-card ${isLost ? "report-card-lost" : "report-card-found"}${item.photo ? " report-card-has-photo" : ""}`;
  card.style.animationDelay = `${Math.min(index * 55, 300)}ms`;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Lihat detail ${item.name}`);
  card.dataset.id = item.id;
  card.innerHTML = `
    <div class="card-top">
      <span class="status-badge ${isLost ? "lost" : "found"}">${isLost ? "!" : "✓"} ${escapeHTML(item.status)}</span>
      <span class="card-date">${escapeHTML(formatDate(item.date))}</span>
      ${itemImage}
    </div>
    <div class="card-body">
      <span class="card-category">${escapeHTML(item.category)}</span>
      <h3>${escapeHTML(item.name)}</h3>
      <p class="card-description">${escapeHTML(item.description)}</p>
      <div class="card-location"><span aria-hidden="true">⌖</span>${escapeHTML(item.location)}</div>
    </div>
    <div class="card-bottom"><span class="reporter-label">${item.source === "user" ? "Laporan pengguna" : "Laporan contoh"}</span><span class="detail-link">Lihat detail →</span></div>`;
  card.addEventListener("click", () => openDetail(item.id));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail(item.id);
    }
  });
  return card;
}

function renderReports() {
  const filtered = getFilteredReports();
  reportGrid.replaceChildren();
  filtered.forEach((item, index) =>
    reportGrid.appendChild(createReportCard(item, index)),
  );
  emptyState.classList.toggle("hidden", filtered.length !== 0);
  reportGrid.classList.toggle("hidden", filtered.length === 0);
  $("#result-count").textContent = `${filtered.length} laporan ditampilkan`;
}

function openDetail(id) {
  const item = reports.find((report) => report.id === id);
  if (!item) return;
  const isLost = item.status === "Hilang";
  modalContent.innerHTML = `
    <span class="status-badge ${isLost ? "lost" : "found"}">${isLost ? "!" : "✓"} ${escapeHTML(item.status)}</span>
    <h2 id="modal-title">${escapeHTML(item.name)}</h2>
    ${item.photo ? `<img class="modal-photo" src="${escapeHTML(item.photo)}" alt="Foto ${escapeHTML(item.name)}">` : ""}
    <p class="modal-description">${escapeHTML(item.description)}</p>
    <dl class="modal-meta">
      <div><dt>Kategori</dt><dd>${escapeHTML(item.category)}</dd></div>
      <div><dt>Lokasi</dt><dd>${escapeHTML(item.location)}</dd></div>
      <div><dt>Tanggal kejadian</dt><dd>${escapeHTML(formatDate(item.date))}</dd></div>
    </dl>
    <div class="contact-box"><strong>Kontak yang bisa dihubungi</strong><p>${escapeHTML(item.contact)}</p></div>`;
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  $("#modal-close").focus();
}

function closeDetail() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add("hidden"), 5000);
}

function clearFieldError(fieldName) {
  const field = reportForm.querySelector(`[name="${fieldName}"]`);
  const container =
    fieldName === "status"
      ? reportForm.querySelector(".status-field")
      : field?.closest(".field");
  container?.classList.remove("invalid");
  const error = $(`#${fieldName}-error`);
  if (error) error.textContent = "";
}

function setFieldError(fieldName, message) {
  const field = reportForm.querySelector(`[name="${fieldName}"]`);
  const container =
    fieldName === "status"
      ? reportForm.querySelector(".status-field")
      : field?.closest(".field");
  container?.classList.add("invalid");
  const error = $(`#${fieldName}-error`);
  if (error) error.textContent = message;
}

function validateForm() {
  const values = {
    name: $("#item-name").value.trim(),
    category: $("#item-category").value,
    status:
      reportForm.querySelector('input[name="status"]:checked')?.value || "",
    location: $("#item-location").value.trim(),
    date: $("#item-date").value,
    description: $("#item-description").value.trim(),
    contact: $("#item-contact").value.trim(),
  };
  const errors = {};
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (!values.name) errors.name = "Nama barang wajib diisi.";
  else if (values.name.length < 3)
    errors.name = "Nama barang minimal 3 karakter.";
  if (!values.category) errors.category = "Pilih kategori barang.";
  if (!values.status) errors.status = "Pilih status laporan.";
  if (!values.location) errors.location = "Lokasi wajib diisi.";
  if (!values.date) errors.date = "Tanggal kejadian wajib diisi.";
  else if (values.date > localToday)
    errors.date = "Tanggal tidak boleh di masa depan.";
  if (!values.description) errors.description = "Deskripsi barang wajib diisi.";
  if (!values.contact) errors.contact = "Kontak wajib diisi.";
  else {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^\+?[0-9][0-9\s().-]{7,18}$/;
    if (
      !emailPattern.test(values.contact) &&
      !phonePattern.test(values.contact)
    ) {
      errors.contact = "Masukkan email atau nomor HP yang valid.";
    }
  }

  [
    "name",
    "category",
    "status",
    "location",
    "date",
    "description",
    "contact",
  ].forEach((key) => {
    clearFieldError(key);
    if (errors[key]) setFieldError(key, errors[key]);
  });
  return { values, errors };
}

function resetFormErrors() {
  [
    "name",
    "category",
    "status",
    "location",
    "date",
    "description",
    "contact",
  ].forEach(clearFieldError);
}

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (photoProcessing) return;
  const { values, errors } = validateForm();
  const feedback = $("#form-feedback");
  feedback.classList.add("hidden");
  if (Object.keys(errors).length > 0) {
    const firstInvalid = reportForm.querySelector(
      ".field.invalid input:not([type=radio]), .field.invalid select, .field.invalid textarea, .status-field.invalid input",
    );
    firstInvalid?.focus();
    return;
  }

  const pendingReport = {
    createdAt: getLocalDate(),
    updatedAt: getLocalDate(),
    ...values,
    ...(selectedPhoto ? { photo: selectedPhoto } : {}),
  };
  let newReport;
  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingReport),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Server menolak laporan.");
    newReport = result;
  } catch (error) {
    feedback.textContent = `Laporan belum tersimpan. ${apiFailureMessage(error)}`;
    feedback.className = "form-feedback error";
    feedback.classList.remove("hidden");
    showToast(
      "Laporan belum tersimpan. Jalankan node server.js, lalu coba lagi.",
    );
    return;
  }

  reports.unshift({ ...newReport, source: "user" });
  notifyReportsChanged();
  renderReports();
  updateStats();
  reportForm.reset();
  resetPublicPhoto();
  resetFormErrors();
  $("#item-date").max = getLocalDate();
  feedback.textContent =
    "Laporan berhasil dibuat dan tersimpan di server. Silakan cek statusnya secara berkala pada halaman Laporan.";
  feedback.className = "form-feedback success";
  feedback.classList.remove("hidden");
  showToast(
    "Laporan berhasil dibuat dan tersimpan di server. Silakan cek statusnya secara berkala. Terima kasih sudah membantu.",
  );
  $("#search-input").value = "";
  categoryFilter.value = "Semua";
  statusFilter.value = "Semua";
  renderReports();
  updateStats();
  document.querySelector("#laporan").scrollIntoView({ behavior: "smooth" });
});

itemPhotoInput.addEventListener("change", async () => {
  const file = itemPhotoInput.files[0];
  const error = $("#item-photo-error");
  const submitButton = reportForm.querySelector('button[type="submit"]');
  error.textContent = "";
  if (!file) return;

  photoProcessing = true;
  selectedPhoto = "";
  itemPhotoPreview.classList.add("hidden");
  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  try {
    selectedPhoto = await compressPublicPhoto(file);
    $("#item-photo-preview-image").src = selectedPhoto;
    itemPhotoPreview.classList.remove("hidden");
    $("#remove-item-photo").classList.remove("hidden");
  } catch (uploadError) {
    itemPhotoInput.value = "";
    error.textContent = uploadError.message;
  } finally {
    photoProcessing = false;
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
  }
});

$("#remove-item-photo").addEventListener("click", resetPublicPhoto);

["name", "category", "location", "date", "description", "contact"].forEach(
  (key) => {
    const field = reportForm.querySelector(`[name="${key}"]`);
    field.addEventListener("input", () => clearFieldError(key));
    field.addEventListener("change", () => clearFieldError(key));
  },
);
reportForm.querySelectorAll('input[name="status"]').forEach((input) => {
  input.addEventListener("change", () => clearFieldError("status"));
});

searchInput.addEventListener("input", renderReports);
categoryFilter.addEventListener("change", renderReports);
statusFilter.addEventListener("change", renderReports);

function resetFilters() {
  searchInput.value = "";
  categoryFilter.value = "Semua";
  statusFilter.value = "Semua";
  renderReports();
}
$("#reset-filter").addEventListener("click", resetFilters);
$("#empty-reset").addEventListener("click", resetFilters);
$("#modal-close").addEventListener("click", closeDetail);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeDetail();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.classList.contains("hidden"))
    closeDetail();
});

const menuToggle = $("#menu-toggle");
const navLinks = $("#nav-links");
menuToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "Tutup menu navigasi" : "Buka menu navigasi",
  );
  menuToggle.textContent = isOpen ? "×" : "☰";
});
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Buka menu navigasi");
    menuToggle.textContent = "☰";
  });
});

function getLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function setupScrollReveal() {
  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const targets = document.querySelectorAll(
    ".stats-section .stat-intro, .stats-section .stat-card, .reports-section .section-heading, .reports-section .filter-panel, .reports-section .results-line, .form-section .form-aside, .form-section .report-form, .about-section .about-header, .about-section .step-card, .about-section .disclaimer",
  );
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -36px 0px" },
  );

  targets.forEach((target, index) => {
    target.classList.add("reveal-on-scroll");
    target.style.setProperty("--reveal-delay", `${(index % 4) * 65}ms`);
    observer.observe(target);
  });
}

setupScrollReveal();
$("#item-date").max = getLocalDate();
$("#current-year").textContent = new Date().getFullYear();

loadReports();

window.addEventListener("storage", (event) => {
  if ([STORAGE_KEY, ADMIN_DATA_KEY, REPORTS_SYNC_KEY].includes(event.key))
    loadReports();
});
