const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = "lostFoundCampusReports";
const ADMIN_DATA_KEY = "lostFoundCampusAdminChanges";
const REPORTS_SYNC_KEY = "lostFoundCampusReportsSync";
const ADMIN_SESSION_KEY = "lostFoundCampusAdminSession";
const ADMIN_USERS_KEY = "lostFoundCampusAdminUsers";
const DEMO_ACCOUNT = { username: "admin", password: "campus123" };
const categories = [
  "Elektronik",
  "Dokumen",
  "Tas",
  "Kunci",
  "Aksesori",
  "Pakaian",
  "Lainnya",
];
const categoryIcons = {
  Elektronik: "⌁",
  Dokumen: "▤",
  Tas: "▱",
  Kunci: "⌘",
  Aksesori: "◇",
  Pakaian: "▧",
  Lainnya: "□",
};
let reports = [];
let activeView = "overview";
let activeStatus = "Semua";
let selectedPhoto = "";
let removeCurrentPhoto = false;
let toastTimer;
let previousFocus;

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
    return "Tidak dapat terhubung ke API. Jalankan node server.js dan buka dashboard melalui http://localhost:3000/admin/.";
  }
  return error.message || "Server gagal memproses perubahan.";
}

function readAdmins() {
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_USERS_KEY) || "null");
    if (Array.isArray(saved)) {
      const admins = saved.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.username === "string" &&
          typeof item.password === "string" &&
          typeof item.createdAt === "string",
      );
      if (admins.length) return admins;
    }
  } catch (error) {
    console.warn("Daftar admin tidak bisa dibaca.", error);
  }
  return [
    {
      id: "admin-default",
      ...DEMO_ACCOUNT,
      createdAt: "",
    },
  ];
}

function saveAdmins(admins) {
  try {
    localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(admins));
    return true;
  } catch (error) {
    console.error("Daftar admin tidak bisa disimpan.", error);
    showToast("Akun admin gagal disimpan. Periksa ruang penyimpanan browser.");
    return false;
  }
}

function currentAdminUsername() {
  const sessionUsername = sessionStorage.getItem(ADMIN_SESSION_KEY);
  return sessionUsername && sessionUsername !== "active"
    ? sessionUsername
    : DEMO_ACCOUNT.username;
}

function validReport(item) {
  return (
    item &&
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

function readSavedReports() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(validReport) : [];
  } catch (error) {
    console.warn("Data laporan pengguna tidak bisa dibaca.", error);
    return [];
  }
}

function readAdminChanges() {
  try {
    const changes = JSON.parse(localStorage.getItem(ADMIN_DATA_KEY) || "{}");
    return {
      overrides:
        changes.overrides && typeof changes.overrides === "object"
          ? changes.overrides
          : {},
      deletedIds: Array.isArray(changes.deletedIds)
        ? changes.deletedIds.filter((id) => typeof id === "string")
        : [],
    };
  } catch (error) {
    console.warn("Perubahan admin tidak bisa dibaca.", error);
    return { overrides: {}, deletedIds: [] };
  }
}

function applyAdminChanges(items) {
  const changes = readAdminChanges();
  const deleted = new Set(changes.deletedIds);
  return items
    .filter((item) => !deleted.has(item.id))
    .map((item) => ({
      ...item,
      ...(changes.overrides[item.id] || {}),
      source: item.source,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function loadReports() {
  try {
    const response = await fetch("../api/reports", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const serverReports = await response.json();
    if (!Array.isArray(serverReports))
      throw new Error("Format data dari server tidak sesuai.");
    reports = serverReports
      .filter(validReport)
      .map((item) => ({
        ...item,
        source:
          item.source || (item.id.startsWith("sample-") ? "sample" : "user"),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    $("#admin-storage-title").textContent = "Data tersimpan di server";
    $("#admin-storage-description").textContent =
      "Laporan dan foto masuk ke folder proyek.";
    renderAll();
    return;
  } catch (apiError) {
    console.warn("API penyimpanan belum tersedia:", apiError);
    $("#admin-storage-title").textContent = "Mode pratinjau";
    $("#admin-storage-description").textContent =
      "Perubahan belum tersimpan ke folder proyek.";
  }

  try {
    const response = await fetch("../data.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const samples = await response.json();
    if (!Array.isArray(samples))
      throw new Error("Format data.json tidak valid.");
    const saved = readSavedReports().map((item) => ({
      ...item,
      source: "user",
    }));
    const savedIds = new Set(saved.map((item) => item.id));
    const initial = samples
      .filter(validReport)
      .filter((item) => !savedIds.has(item.id))
      .map((item) => ({ ...item, source: "sample" }));
    reports = applyAdminChanges([...saved, ...initial]);
    renderAll();
    showToast(
      "Mode pratinjau aktif. Jalankan node server.js untuk penyimpanan permanen.",
    );
  } catch (error) {
    console.error("Laporan gagal dimuat.", error);
    reports = applyAdminChanges(
      readSavedReports().map((item) => ({ ...item, source: "user" })),
    );
    renderAll();
    showToast(
      "Data contoh tidak termuat. Jalankan website melalui server lokal.",
    );
  }
}

function showToast(message) {
  const toast = $("#admin-toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3600);
}

function reportImage(item, className = "") {
  if (!item.photo)
    return `<span class="${className}" aria-hidden="true">${categoryIcons[item.category] || "□"}</span>`;
  return `<span class="${className}"><img src="${escapeHTML(item.photo)}" alt="Foto ${escapeHTML(item.name)}"></span>`;
}

function renderMetrics() {
  $("#metric-total").textContent = reports.length;
  $("#metric-lost").textContent = reports.filter(
    (item) => item.status === "Hilang",
  ).length;
  $("#metric-found").textContent = reports.filter(
    (item) => item.status === "Ditemukan",
  ).length;
  $("#metric-photos").textContent = reports.filter((item) => item.photo).length;
  $("#category-total").textContent = `${reports.length} item`;

  const counts = categories.map((category) => ({
    category,
    count: reports.filter((item) => item.category === category).length,
  }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  $("#category-list").innerHTML =
    counts
      .filter((item) => item.count > 0)
      .map(
        ({ category, count }) => `
    <div class="category-row"><span>${escapeHTML(category)}</span><span class="category-track"><i style="width:${Math.max(8, (count / max) * 100)}%"></i></span><b>${count}</b></div>`,
      )
      .join("") || '<small class="table-sub">Belum ada data kategori.</small>';
}

function renderLatest() {
  const latest = reports.slice(0, 5);
  $("#latest-list").innerHTML =
    latest
      .map(
        (item) => `
    <article class="latest-item">
      ${reportImage(item, "latest-thumb")}
      <div class="latest-name"><b>${escapeHTML(item.name)}</b><small>${escapeHTML(item.location)} · ${formatDate(item.date)}</small></div>
      <div class="latest-actions"><span class="status-pill ${item.status === "Hilang" ? "lost" : "found"}">${escapeHTML(item.status)}</span><button class="tiny-action" type="button" data-action="edit" data-id="${escapeHTML(item.id)}">Edit</button></div>
    </article>`,
      )
      .join("") || '<p class="table-sub">Belum ada laporan.</p>';
}

function getManagerReports() {
  const query = $("#manager-search").value.trim().toLocaleLowerCase("id-ID");
  const selectedStatus = $("#manager-status").value;
  return reports.filter(
    (item) =>
      (activeStatus === "Semua" || item.status === activeStatus) &&
      (selectedStatus === "Semua" || item.status === selectedStatus) &&
      `${item.name} ${item.location} ${item.category}`
        .toLocaleLowerCase("id-ID")
        .includes(query),
  );
}

function renderReportTable() {
  const filtered = getManagerReports();
  $("#manager-count").textContent = `${filtered.length} laporan`;
  $("#report-table-body").innerHTML = filtered
    .map(
      (item) => `
    <tr>
      <td><div class="table-item">${reportImage(item, "table-thumb")}<div><b>${escapeHTML(item.name)}</b><small>${escapeHTML(item.description.slice(0, 65))}${item.description.length > 65 ? "…" : ""}</small></div></div></td>
      <td>${escapeHTML(item.category)}</td>
      <td><span class="status-pill ${item.status === "Hilang" ? "lost" : "found"}">${escapeHTML(item.status)}</span></td>
      <td>${escapeHTML(item.location)}</td>
      <td>${formatDate(item.date)}</td>
      <td>${item.updatedAt ? formatDate(item.updatedAt) : "Belum diperbarui"}</td>
      <td>${item.source === "user" ? "Pengguna" : "Contoh"}</td>
      <td><div class="row-actions"><button class="row-action" type="button" data-action="edit" data-id="${escapeHTML(item.id)}" aria-label="Edit ${escapeHTML(item.name)}" title="Edit">✎</button><button class="row-action" type="button" data-action="print" data-id="${escapeHTML(item.id)}" aria-label="Cetak ${escapeHTML(item.name)}" title="Cetak">⎙</button><button class="row-action delete" type="button" data-action="delete" data-id="${escapeHTML(item.id)}" aria-label="Hapus ${escapeHTML(item.name)}" title="Hapus">×</button></div></td>
    </tr>`,
    )
    .join("");
  $("#table-empty").classList.toggle("hidden", filtered.length > 0);
}

function renderGallery() {
  const withPhotos = reports.filter((item) => item.photo);
  const lost = withPhotos.filter((item) => item.status === "Hilang");
  const found = withPhotos.filter((item) => item.status === "Ditemukan");
  $("#gallery-lost-count").textContent = `${lost.length} foto`;
  $("#gallery-found-count").textContent = `${found.length} foto`;
  $("#gallery-empty").classList.toggle("hidden", withPhotos.length > 0);
  $("#photo-gallery").innerHTML = withPhotos
    .map(
      (item) => `
    <article class="gallery-card"><div class="gallery-photo"><img src="${escapeHTML(item.photo)}" alt="Foto ${escapeHTML(item.name)}"></div><div class="gallery-card-body"><h3>${escapeHTML(item.name)}</h3><div class="gallery-meta"><span>${escapeHTML(item.category)}</span><span class="status-pill ${item.status === "Hilang" ? "lost" : "found"}">${escapeHTML(item.status)}</span></div><div class="gallery-meta"><span>${escapeHTML(item.location)}</span><span>${formatDate(item.date)}</span></div><div class="gallery-actions"><button class="admin-button admin-button-quiet" type="button" data-action="edit" data-id="${escapeHTML(item.id)}">Edit foto</button><button class="admin-button admin-button-quiet" type="button" data-action="print" data-id="${escapeHTML(item.id)}">Cetak</button></div></div></article>`,
    )
    .join("");
}

function renderAdminIdentity() {
  const username = currentAdminUsername();
  $("#current-admin-name").textContent = username;
  $("#current-admin-avatar").textContent = username.slice(0, 1).toUpperCase();
  $("#current-admin-role").textContent =
    username.toLowerCase() === DEMO_ACCOUNT.username
      ? "Admin demo"
      : "Admin terdaftar";
}

function renderAdminUsers() {
  const admins = readAdmins();
  const currentUsername = currentAdminUsername().toLowerCase();
  $("#admin-user-count").textContent = `${admins.length} admin`;
  $("#admin-list-body").innerHTML = admins
    .map((admin) => {
      const isCurrent = admin.username.toLowerCase() === currentUsername;
      const isDefault = admin.id === "admin-default";
      return `
        <tr>
          <td><div class="table-item"><span class="admin-user-avatar">${escapeHTML(admin.username.slice(0, 1).toUpperCase())}</span><div><b>${escapeHTML(admin.username)}</b><small>${isCurrent ? "Sesi aktif" : "Akun pengelola"}</small></div></div></td>
          <td><span class="status-pill found">Aktif</span></td>
          <td>${isDefault ? "Akun bawaan" : formatDate(admin.createdAt)}</td>
          <td><div class="row-actions"><button class="row-action delete" type="button" data-remove-admin="${escapeHTML(admin.id)}" aria-label="Hapus admin ${escapeHTML(admin.username)}" title="Hapus" ${isCurrent || admins.length <= 1 ? "disabled" : ""}>×</button></div></td>
        </tr>`;
    })
    .join("");
}

function renderAll() {
  renderMetrics();
  renderLatest();
  renderReportTable();
  renderGallery();
}

function setView(view, status = "Semua") {
  activeView = view;
  activeStatus = status;
  $("#overview-view").classList.toggle("hidden", view !== "overview");
  $("#reports-view").classList.toggle("hidden", view !== "reports");
  $("#photos-view").classList.toggle("hidden", view !== "photos");
  $("#admins-view").classList.toggle("hidden", view !== "admins");
  document.querySelectorAll(".side-link[data-view]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.view === view &&
        (view !== "reports" || button.dataset.filter === status),
    );
  });
  $("#reports-title").innerHTML =
    status === "Semua"
      ? "Semua <span>laporan</span>"
      : `Barang <span>${status.toLocaleLowerCase("id-ID")}</span>`;
  $("#manager-status").value = status;
  $("#manager-search").value = "";
  $("#sidebar").classList.remove("open");
  $("#sidebar-toggle").setAttribute("aria-expanded", "false");
  renderReportTable();
  if (view === "admins") renderAdminUsers();
}

function showDashboard() {
  $("#login-stage").classList.add("hidden");
  $("#admin-app").classList.remove("hidden");
  renderAdminIdentity();
  renderAdminUsers();
  loadReports();
}

function openEdit(id) {
  const item = reports.find((report) => report.id === id);
  if (!item) return;
  previousFocus = document.activeElement;
  $("#edit-id").value = item.id;
  $("#edit-name").value = item.name;
  $("#edit-category").value = categories.includes(item.category)
    ? item.category
    : "Lainnya";
  $("#edit-status").value = item.status;
  $("#edit-location").value = item.location;
  $("#edit-date").value = item.date;
  $("#edit-description").value = item.description;
  $("#edit-contact").value = item.contact;
  selectedPhoto = "";
  removeCurrentPhoto = false;
  $("#edit-photo").value = "";
  $("#edit-error").textContent = "";
  updatePhotoPreview(item.photo || "");
  $("#edit-modal").classList.remove("hidden");
  $("#close-edit").focus();
}

function updatePhotoPreview(photo) {
  const preview = $("#photo-preview");
  preview.innerHTML = photo
    ? `<img src="${escapeHTML(photo)}" alt="Pratinjau foto barang">`
    : "<span>▧</span><small>Belum ada foto</small>";
  $("#remove-photo").classList.toggle("hidden", !photo);
}

function closeEdit() {
  $("#edit-modal").classList.add("hidden");
  previousFocus?.focus();
}

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return reject(new Error("Gunakan foto JPG, PNG, atau WebP."));
    }
    if (file.size > 8 * 1024 * 1024)
      return reject(new Error("Ukuran gambar maksimal 8 MB."));
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Berkas gambar tidak dapat dibaca."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Gambar tidak dapat dibuka."));
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

function saveAdminChanges(changes) {
  try {
    localStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(changes));
    return true;
  } catch (error) {
    console.error("Perubahan tidak bisa disimpan.", error);
    showToast(
      "Penyimpanan browser penuh atau tidak tersedia. Coba foto yang lebih kecil.",
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

function collectEditValues() {
  return {
    name: $("#edit-name").value.trim(),
    category: $("#edit-category").value,
    status: $("#edit-status").value,
    location: $("#edit-location").value.trim(),
    date: $("#edit-date").value,
    description: $("#edit-description").value.trim(),
    contact: $("#edit-contact").value.trim(),
  };
}

function getLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function validEdit(values) {
  if (values.name.length < 3) return "Nama barang minimal 3 karakter.";
  if (
    !values.location ||
    !values.date ||
    !values.description ||
    !values.contact
  )
    return "Semua informasi wajib diisi.";
  if (values.date > getLocalDate())
    return "Tanggal kejadian tidak boleh di masa depan.";
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contact);
  const validPhone = /^\+?[0-9][0-9\s().-]{7,18}$/.test(values.contact);
  if (!validEmail && !validPhone)
    return "Kontak harus berupa email atau nomor HP yang valid.";
  return "";
}

async function submitEdit(event) {
  event.preventDefault();
  const values = collectEditValues();
  const error = validEdit(values);
  if (error) {
    $("#edit-error").textContent = error;
    return;
  }
  const existing = reports.find((item) => item.id === $("#edit-id").value);
  values.createdAt = existing?.createdAt || "";
  values.updatedAt = getLocalDate();
  if (selectedPhoto) values.photo = selectedPhoto;
  else if (removeCurrentPhoto) values.photo = "";
  else if (existing?.photo) values.photo = existing.photo;

  const id = $("#edit-id").value;
  try {
    const response = await fetch(`../api/reports/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Laporan gagal diperbarui.");
    reports = reports.map((item) => (item.id === id ? result : item));
  } catch (error) {
    const message = apiFailureMessage(error);
    $("#edit-error").textContent = message;
    showToast(message);
    return;
  }
  notifyReportsChanged();
  renderAll();
  closeEdit();
  showToast("Laporan berhasil diperbarui dan disimpan ke folder proyek.");
}

async function deleteReport(id) {
  const item = reports.find((report) => report.id === id);
  if (
    !item ||
    !window.confirm(
      `Hapus laporan “${item.name}” dari daftar pada browser ini?`,
    )
  )
    return;
  try {
    const response = await fetch(`../api/reports/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Laporan gagal dihapus.");
  } catch (error) {
    showToast("Laporan belum dihapus. Pastikan server Node.js aktif.");
    return;
  }
  reports = reports.filter((report) => report.id !== id);
  notifyReportsChanged();
  renderAll();
  showToast("Laporan dihapus dari server dan folder proyek.");
}

function printReport(item) {
  $("#print-area").innerHTML = `
    <header><h1>Lost & Found Campus</h1><p>Detail laporan barang · Dicetak ${formatDate(new Date().toISOString().slice(0, 10))}</p></header><hr>
    <h2>${escapeHTML(item.name)}</h2><p><b>Status:</b> ${escapeHTML(item.status)} · <b>Kategori:</b> ${escapeHTML(item.category)}</p>
    ${item.photo ? `<img class="print-photo" src="${escapeHTML(item.photo)}" alt="Foto ${escapeHTML(item.name)}">` : ""}
    <dl class="print-meta"><dt>Lokasi</dt><dd>${escapeHTML(item.location)}</dd><dt>Tanggal kejadian</dt><dd>${formatDate(item.date)}</dd><dt>Terakhir diperbarui</dt><dd>${item.updatedAt ? formatDate(item.updatedAt) : "Belum diperbarui"}</dd><dt>Kontak</dt><dd>${escapeHTML(item.contact)}</dd></dl>
    <h3>Deskripsi</h3><p>${escapeHTML(item.description)}</p><hr><small>Data ini berasal dari dashboard Lost & Found Campus.</small>`;
  window.print();
}

function printReportList(items) {
  const rows = items
    .map(
      (item) =>
        `<tr><td>${escapeHTML(item.name)}</td><td>${escapeHTML(item.category)}</td><td>${escapeHTML(item.status)}</td><td>${escapeHTML(item.location)}</td><td>${formatDate(item.date)}</td><td>${item.updatedAt ? formatDate(item.updatedAt) : "Belum diperbarui"}</td><td>${escapeHTML(item.contact)}</td></tr>`,
    )
    .join("");
  $("#print-area").innerHTML =
    `<h1>Daftar laporan Lost & Found Campus</h1><p>Dicetak ${formatDate(new Date().toISOString().slice(0, 10))} · ${items.length} laporan</p><table><thead><tr><th>Barang</th><th>Kategori</th><th>Status</th><th>Lokasi</th><th>Tanggal kejadian</th><th>Terakhir diperbarui</th><th>Kontak</th></tr></thead><tbody>${rows}</tbody></table>`;
  window.print();
}

function handleAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const item = reports.find((report) => report.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "edit") openEdit(item.id);
  if (button.dataset.action === "print") printReport(item);
  if (button.dataset.action === "delete") deleteReport(item.id);
}

$("#admin-create-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const username = $("#new-admin-username").value.trim();
  const password = $("#new-admin-password").value;
  const confirmation = $("#new-admin-confirm").value;
  const error = $("#admin-create-error");
  error.textContent = "";

  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(username)) {
    error.textContent =
      "Username harus 3–24 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.";
    return;
  }
  if (password.length < 8) {
    error.textContent = "Kata sandi harus terdiri dari minimal 8 karakter.";
    return;
  }
  if (password !== confirmation) {
    error.textContent = "Konfirmasi kata sandi belum sama.";
    return;
  }

  const admins = readAdmins();
  if (
    admins.some(
      (admin) => admin.username.toLowerCase() === username.toLowerCase(),
    )
  ) {
    error.textContent = "Username tersebut sudah terdaftar.";
    return;
  }

  const newAdmin = {
    id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username,
    password,
    createdAt: getLocalDate(),
  };
  if (!saveAdmins([...admins, newAdmin])) return;
  $("#admin-create-form").reset();
  renderAdminUsers();
  showToast(`Admin ${username} berhasil ditambahkan.`);
});

$("#admin-list-body").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-admin]");
  if (!button) return;
  const admins = readAdmins();
  const selected = admins.find(
    (admin) => admin.id === button.dataset.removeAdmin,
  );
  if (!selected) return;
  if (
    selected.username.toLowerCase() === currentAdminUsername().toLowerCase()
  ) {
    showToast("Akun yang sedang digunakan tidak dapat dihapus.");
    return;
  }
  if (admins.length <= 1) {
    showToast("Minimal satu akun admin harus tetap terdaftar.");
    return;
  }
  if (!window.confirm(`Hapus akun admin ${selected.username}?`)) return;
  if (!saveAdmins(admins.filter((admin) => admin.id !== selected.id))) return;
  renderAdminUsers();
  showToast(`Admin ${selected.username} berhasil dihapus.`);
});

$("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const username = $("#admin-username").value.trim();
  const password = $("#admin-password").value;
  const account = readAdmins().find(
    (admin) =>
      admin.username.toLowerCase() === username.toLowerCase() &&
      admin.password === password,
  );
  if (!account) {
    $("#login-error").textContent =
      "Nama pengguna atau kata sandi tidak sesuai.";
    $("#admin-password").focus();
    return;
  }
  sessionStorage.setItem(ADMIN_SESSION_KEY, account.username);
  $("#login-error").textContent = "";
  showDashboard();
});

$("#logout-button").addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  $("#admin-app").classList.add("hidden");
  $("#login-stage").classList.remove("hidden");
  $("#login-form").reset();
  $("#admin-username").focus();
});

document.querySelectorAll(".side-link[data-view]").forEach((button) => {
  button.addEventListener("click", () =>
    setView(button.dataset.view, button.dataset.filter || "Semua"),
  );
});
document
  .querySelectorAll("[data-open-reports]")
  .forEach((button) =>
    button.addEventListener("click", () => setView("reports")),
  );
$("#manager-search").addEventListener("input", renderReportTable);
$("#manager-status").addEventListener("change", () => {
  activeStatus = "Semua";
  document
    .querySelectorAll(".side-link[data-view]")
    .forEach((button) => button.classList.remove("active"));
  renderReportTable();
});
$("#overview-print").addEventListener("click", () => printReportList(reports));
$("#print-list").addEventListener("click", () =>
  printReportList(getManagerReports()),
);
$("#photo-print").addEventListener("click", () =>
  printReportList(reports.filter((item) => item.photo)),
);
$("#report-table-body").addEventListener("click", handleAction);
$("#latest-list").addEventListener("click", handleAction);
$("#photo-gallery").addEventListener("click", handleAction);
$("#edit-form").addEventListener("submit", submitEdit);
$("#close-edit").addEventListener("click", closeEdit);
$("#cancel-edit").addEventListener("click", closeEdit);
$("#edit-modal").addEventListener("click", (event) => {
  if (event.target === $("#edit-modal")) closeEdit();
});
$("#edit-photo").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    selectedPhoto = await compressPhoto(file);
    removeCurrentPhoto = false;
    updatePhotoPreview(selectedPhoto);
    $("#edit-error").textContent = "";
  } catch (error) {
    selectedPhoto = "";
    event.target.value = "";
    $("#edit-error").textContent = error.message;
  }
});
$("#remove-photo").addEventListener("click", () => {
  selectedPhoto = "";
  removeCurrentPhoto = true;
  $("#edit-photo").value = "";
  updatePhotoPreview("");
});
$("#sidebar-toggle").addEventListener("click", () => {
  const open = $("#sidebar").classList.toggle("open");
  $("#sidebar-toggle").setAttribute("aria-expanded", String(open));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#edit-modal").classList.contains("hidden"))
    closeEdit();
});
window.addEventListener("storage", (event) => {
  if (event.key === ADMIN_USERS_KEY) {
    renderAdminUsers();
    const stillRegistered = readAdmins().some(
      (admin) =>
        admin.username.toLowerCase() === currentAdminUsername().toLowerCase(),
    );
    if (!stillRegistered) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      $("#admin-app").classList.add("hidden");
      $("#login-stage").classList.remove("hidden");
    }
  }
  if (
    [STORAGE_KEY, ADMIN_DATA_KEY, REPORTS_SYNC_KEY].includes(event.key) &&
    sessionStorage.getItem(ADMIN_SESSION_KEY)
  )
    loadReports();
});

const savedSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
const authenticatedUsername =
  savedSession === "active" ? DEMO_ACCOUNT.username : savedSession;
if (
  authenticatedUsername &&
  readAdmins().some(
    (admin) =>
      admin.username.toLowerCase() === authenticatedUsername.toLowerCase(),
  )
) {
  showDashboard();
} else if (savedSession) {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
