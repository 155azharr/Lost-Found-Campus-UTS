"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const PORT = Number(process.env.PORT || 3000);
const categories = new Set([
  "Elektronik",
  "Dokumen",
  "Tas",
  "Kunci",
  "Aksesori",
  "Pakaian",
  "Lainnya",
]);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
let databaseQueue = Promise.resolve();

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      throw fail("Ukuran permintaan terlalu besar.", 413);
    }
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw fail("Format JSON tidak valid.");
  }
}

async function readReports() {
  const value = JSON.parse(await fs.readFile(REPORTS_FILE, "utf8"));
  if (!Array.isArray(value))
    throw new Error("Format data/reports.json tidak valid.");
  return value;
}

async function writeReports(reports) {
  const temporaryFile = `${REPORTS_FILE}.${randomUUID()}.tmp`;
  await fs.writeFile(
    temporaryFile,
    `${JSON.stringify(reports, null, 2)}\n`,
    "utf8",
  );
  await fs.rename(temporaryFile, REPORTS_FILE);
}

function updateDatabase(operation) {
  const task = databaseQueue.then(async () => {
    const reports = await readReports();
    const result = await operation(reports);
    await writeReports(reports);
    return result;
  });
  databaseQueue = task.catch(() => {});
  return task;
}

async function readDatabase() {
  await databaseQueue;
  return readReports();
}

function normalizeReport(body, existing = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw fail("Data laporan tidak valid.");
  }
  const value = (key) => String(body[key] ?? existing?.[key] ?? "").trim();
  const report = {
    id: existing?.id || randomUUID(),
    name: value("name"),
    category: value("category"),
    status: value("status"),
    location: value("location"),
    date: value("date"),
    description: value("description"),
    contact: value("contact"),
    createdAt: existing?.createdAt || value("createdAt") || localDate(),
    updatedAt: existing ? localDate() : value("updatedAt") || localDate(),
    source: existing?.source || "user",
  };

  if (report.name.length < 3 || report.name.length > 80) {
    throw fail("Nama barang harus 3 sampai 80 karakter.");
  }
  if (!categories.has(report.category))
    throw fail("Kategori laporan tidak valid.");
  if (!["Hilang", "Ditemukan"].includes(report.status)) {
    throw fail("Status laporan tidak valid.");
  }
  if (!report.location || report.location.length > 120) {
    throw fail("Lokasi wajib diisi dan maksimal 120 karakter.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(report.date) || report.date > localDate()) {
    throw fail("Tanggal kejadian tidak valid atau berada di masa depan.");
  }
  if (!report.description || report.description.length > 600) {
    throw fail("Deskripsi wajib diisi dan maksimal 600 karakter.");
  }
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(report.contact);
  const validPhone = /^\+?[0-9][0-9\s().-]{7,18}$/.test(report.contact);
  if (!validEmail && !validPhone)
    throw fail("Kontak harus berupa email atau nomor HP yang valid.");
  return report;
}

function managedPhotoPath(photo) {
  if (typeof photo !== "string") return null;
  const match = /^\/assets\/images\/(lost|found)\/([A-Za-z0-9_-]+\.jpg)$/.exec(
    photo,
  );
  if (!match) return null;
  return path.join(ROOT_DIR, "assets", "images", match[1], match[2]);
}

function photoDestination(report) {
  const folder = report.status === "Hilang" ? "lost" : "found";
  const safeId = report.id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
  const filename = `${safeId || randomUUID()}.jpg`;
  return {
    file: path.join(ROOT_DIR, "assets", "images", folder, filename),
    url: `/assets/images/${folder}/${filename}`,
  };
}

async function removeManagedPhoto(photo) {
  const photoPath = managedPhotoPath(photo);
  if (!photoPath) return;
  try {
    await fs.unlink(photoPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function storePhoto(report, photoData, oldPhoto = "") {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    photoData,
  );
  if (!match)
    throw fail("Foto harus berupa JPEG yang sudah diproses di browser.");
  const image = Buffer.from(match[1], "base64");
  if (!image.length || image.length > 8 * 1024 * 1024) {
    throw fail("Ukuran foto hasil kompresi tidak valid.");
  }
  const destination = photoDestination(report);
  await fs.mkdir(path.dirname(destination.file), { recursive: true });
  await fs.writeFile(destination.file, image);
  if (oldPhoto && oldPhoto !== destination.url)
    await removeManagedPhoto(oldPhoto);
  return destination.url;
}

async function movePhoto(report, oldPhoto) {
  if (!oldPhoto) return "";
  const source = managedPhotoPath(oldPhoto);
  if (!source) return oldPhoto;
  const destination = photoDestination(report);
  if (source === destination.file) return oldPhoto;
  try {
    await fs.mkdir(path.dirname(destination.file), { recursive: true });
    await fs.rename(source, destination.file);
    return destination.url;
  } catch (error) {
    if (error.code === "ENOENT") return oldPhoto;
    if (error.code !== "EXDEV") throw error;
    await fs.copyFile(source, destination.file);
    await fs.unlink(source);
    return destination.url;
  }
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/reports" && request.method === "GET") {
    return sendJson(response, 200, await readDatabase());
  }

  if (url.pathname === "/api/reports" && request.method === "POST") {
    const body = await readJsonBody(request);
    const report = normalizeReport(body);
    report.id = randomUUID();
    report.source = "user";
    if (body.photo) report.photo = await storePhoto(report, body.photo);
    await updateDatabase((reports) => reports.unshift(report));
    return sendJson(response, 201, report);
  }

  const reportMatch = /^\/api\/reports\/([^/]+)$/.exec(url.pathname);
  if (reportMatch && request.method === "PUT") {
    const id = decodeURIComponent(reportMatch[1]);
    const body = await readJsonBody(request);
    let updatedReport;
    await updateDatabase(async (reports) => {
      const index = reports.findIndex((item) => item.id === id);
      if (index === -1) throw fail("Laporan tidak ditemukan.", 404);
      const existing = reports[index];
      updatedReport = normalizeReport(body, existing);
      if (Object.hasOwn(body, "photo")) {
        if (typeof body.photo !== "string")
          throw fail("Nilai foto tidak valid.");
        if (body.photo.startsWith("data:")) {
          updatedReport.photo = await storePhoto(
            updatedReport,
            body.photo,
            existing.photo,
          );
        } else if (!body.photo) {
          await removeManagedPhoto(existing.photo);
          delete updatedReport.photo;
        } else if (body.photo === existing.photo) {
          const movedPhoto = await movePhoto(updatedReport, existing.photo);
          if (movedPhoto) updatedReport.photo = movedPhoto;
          else delete updatedReport.photo;
        } else {
          throw fail("Foto laporan tidak valid.");
        }
      } else if (existing.photo) {
        updatedReport.photo = await movePhoto(updatedReport, existing.photo);
      }
      reports[index] = updatedReport;
    });
    return sendJson(response, 200, updatedReport);
  }

  if (reportMatch && request.method === "DELETE") {
    const id = decodeURIComponent(reportMatch[1]);
    let deletedReport;
    await updateDatabase(async (reports) => {
      const index = reports.findIndex((item) => item.id === id);
      if (index === -1) throw fail("Laporan tidak ditemukan.", 404);
      [deletedReport] = reports.splice(index, 1);
      await removeManagedPhoto(deletedReport.photo);
    });
    return sendJson(response, 200, { deleted: true, id: deletedReport.id });
  }

  return sendJson(response, 404, { error: "Endpoint tidak ditemukan." });
}

async function serveStatic(request, response, pathname) {
  if (pathname === "/data/reports.json" || pathname.startsWith("/data/")) {
    return sendJson(response, 404, { error: "Berkas tidak ditemukan." });
  }
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return sendJson(response, 400, { error: "Alamat berkas tidak valid." });
  }
  const relativePath =
    decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, "");
  let filePath = path.resolve(ROOT_DIR, relativePath);
  const rootPrefix = `${ROOT_DIR}${path.sep}`;
  if (filePath !== ROOT_DIR && !filePath.startsWith(rootPrefix)) {
    return sendJson(response, 403, { error: "Akses berkas ditolak." });
  }
  try {
    let stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      stat = await fs.stat(filePath);
    }
    if (!stat.isFile())
      return sendJson(response, 404, { error: "Berkas tidak ditemukan." });
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Length": content.length,
      "Content-Type":
        mimeTypes[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return sendJson(response, 404, { error: "Berkas tidak ditemukan." });
    }
    throw error;
  }
}

async function initialize() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.join(ROOT_DIR, "assets", "images", "lost"), {
    recursive: true,
  });
  await fs.mkdir(path.join(ROOT_DIR, "assets", "images", "found"), {
    recursive: true,
  });
  try {
    await readReports();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const samples = JSON.parse(
      await fs.readFile(path.join(ROOT_DIR, "data.json"), "utf8"),
    );
    await writeReports(samples.map((item) => ({ ...item, source: "sample" })));
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(
      request.url,
      `http://${request.headers.host || "localhost"}`,
    );
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(response, 405, { error: "Metode tidak didukung." });
    }
    await serveStatic(request, response, url.pathname);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) {
      sendJson(response, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Server gagal memproses permintaan.",
      });
    } else {
      response.destroy();
    }
  }
});

initialize()
  .then(() => {
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Lost & Found Campus berjalan di http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Server gagal dimulai:", error);
    process.exitCode = 1;
  });
