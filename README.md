<div align="center">

# Lost &amp; Found Campus

**Satu tempat untuk melaporkan dan mencari barang hilang atau ditemukan di lingkungan kampus.**

[![HTML](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

[Ringkasan](#ringkasan) · [Fitur](#fitur-utama) · [Menjalankan](#menjalankan-proyek) · [Dashboard Admin](#dashboard-admin) · [Dokumentasi](#dokumentasi)

</div>

---

## Ringkasan

Lost &amp; Found Campus adalah aplikasi web untuk membantu civitas kampus mengumumkan barang hilang, melaporkan barang yang ditemukan, dan menghubungkan pencari dengan pelapor. Website publik dan dashboard admin menggunakan data yang sama melalui server Node.js.

| Area                | Kegunaan                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Website publik**  | Menjelajahi, mencari, memfilter, melihat detail, dan mengirim laporan barang.             |
| **Dashboard admin** | Meninjau laporan, mengubah data dan foto, mengelola status, serta mencetak laporan.       |
| **Penyimpanan**     | Menyimpan laporan dalam JSON dan foto sebagai berkas di komputer yang menjalankan server. |

> **Akses produksi:**
>
> - Website publik: <https://lostfoundcampus.intidatamedia.id>
> - Dashboard admin: <https://lostfoundcampus.intidatamedia.id/admin/>

> **Status proyek:** demo lokal berbasis file. Autentikasi admin belum ditujukan untuk penggunaan produksi.

## Fitur Utama

- **Pencarian dan filter** berdasarkan nama barang, kategori, dan status.
- **Detail laporan** dengan lokasi, tanggal kejadian, deskripsi, foto, dan kontak pelapor.
- **Form laporan** untuk barang hilang atau ditemukan, dengan validasi data dan unggahan foto opsional.
- **Foto yang dioptimalkan** di browser: JPG, PNG, atau WebP hingga 8 MB; gambar dikecilkan sebelum dikirim ke server.
- **Dashboard admin** dengan ringkasan, daftar laporan, filter, galeri foto, edit, hapus, dan cetak.
- **Data bersama** antara website publik dan dashboard; perubahan yang tersimpan dapat dimuat kembali dari server.
- **Tampilan responsif** dengan animasi halus dan dukungan pengurangan gerak (`prefers-reduced-motion`).

## Alur Singkat

1. Pengunjung mencari barang melalui daftar laporan, atau mengirim laporan baru.
2. Server memvalidasi laporan dan menyimpan data ke `data/reports.json`.
3. Jika ada foto, server menyimpannya ke folder sesuai status barang.
4. Admin mengelola laporan dari dashboard; perubahan akan tersedia untuk website publik.

## Menjalankan Proyek

### Persyaratan

- [Node.js 18 atau lebih baru](https://nodejs.org/)
- Tidak ada paket tambahan yang perlu diinstal; server menggunakan modul bawaan Node.js.

### Jalankan server lengkap

Dari direktori proyek, jalankan:

```powershell
node server.js
```

Buka alamat berikut di browser:

- Website publik: <http://localhost:3000>
- Dashboard admin: <http://localhost:3000/admin/>

Hentikan server dengan `Ctrl+C`. Saat pertama kali dijalankan, server menyiapkan folder data bila diperlukan. Jangan membuka halaman melalui `file://` atau menjalankan halaman publik dan admin dari port yang berbeda; keduanya perlu memakai server dan API yang sama.

### Pratinjau statis

Untuk melihat tampilan saja, jalankan salah satu pilihan berikut dari direktori proyek:

```powershell
python -m http.server 8000
```

Lalu buka <http://localhost:8000>. Pratinjau statis hanya menampilkan halaman dan data contoh; API tidak aktif sehingga laporan dan foto tidak dapat disimpan.

## Dashboard Admin

Akses dashboard di <http://localhost:3000/admin/> setelah server berjalan.

**Akun demo**

| Username | Password    |
| -------- | ----------- |
| `admin`  | `campus123` |

Dashboard menyediakan ringkasan, daftar laporan, filter, galeri foto, pengeditan, penghapusan, dan cetak. Admin demo tambahan dapat didaftarkan melalui menu **Kelola admin** pada browser yang sama.

> **Penting:** login dan akun tambahan saat ini dikelola di sisi browser. Kredensial demo terlihat di kode, dan kata sandi admin tambahan disimpan sebagai teks biasa di `localStorage`. Ini bukan autentikasi atau kontrol akses yang aman. Jangan gunakan untuk melindungi data nyata atau mengekspos server ke jaringan publik.

## Penyimpanan Data

- `data.json` berisi enam laporan contoh untuk inisialisasi awal dan pratinjau statis.
- `data/reports.json` menjadi sumber data aktif ketika server Node.js berjalan.
- Foto laporan disimpan sebagai JPEG di `assets/images/lost/` atau `assets/images/found/` sesuai statusnya.
- Server berjalan pada `127.0.0.1` secara default. Data berada di komputer yang menjalankan server, bukan di layanan cloud.
- Kontak pelapor tampil pada detail laporan. Hindari memasukkan informasi sensitif.

## Struktur Proyek

```text
.
├── index.html                 # Halaman publik
├── style.css                  # Gaya dan tata letak publik
├── script.js                  # Interaksi, form, pencarian, dan API publik
├── server.js                  # Server HTTP dan API laporan
├── data.json                  # Data contoh awal
├── data/
│   └── reports.json           # Data laporan aktif
├── admin/
│   └── index.html             # Halaman dashboard admin
├── assets/
│   ├── css/admin.css          # Gaya dashboard
│   ├── js/admin.js            # Interaksi dashboard
│   └── images/
│       ├── lost/              # Foto barang hilang
│       └── found/             # Foto barang ditemukan
└── docs/
    └── SRS.md                 # Spesifikasi kebutuhan sistem
```

## Teknologi

- HTML, CSS, dan JavaScript tanpa framework atau proses build.
- Node.js untuk server HTTP, API, validasi, dan penyimpanan file.
- JSON untuk data laporan; foto disimpan sebagai file JPEG.
- Google Fonts untuk tipografi, dengan font cadangan jika tidak tersedia.

## Pemecahan Masalah

| Kendala                            | Solusi                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Form menyatakan server tidak aktif | Jalankan `node server.js`, lalu buka website melalui `http://localhost:3000`.                                           |
| Perubahan tidak terlihat           | Pastikan halaman publik dan admin memakai origin/server yang sama; periksa `data/reports.json`.                         |
| Foto gagal disimpan                | Gunakan JPG, PNG, atau WebP maksimal 8 MB, dan pastikan Node.js dapat menulis ke folder proyek.                         |
| Foto tidak muncul di dashboard     | Periksa folder `assets/images/lost/` atau `assets/images/found/` dan pastikan halaman memakai server Node.js yang sama. |
| Font terlihat berbeda              | Google Fonts memerlukan koneksi internet; website tetap dapat digunakan dengan font cadangan.                           |

## Dokumentasi

Lihat [Spesifikasi Kebutuhan Sistem (SRS)](docs/SRS.md) untuk arsitektur, alur pengguna, kebutuhan fungsional, aturan validasi, API, dan kamus data.
