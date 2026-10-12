# Lost & Found Campus

Website sederhana untuk membantu mahasiswa melaporkan barang hilang atau ditemukan di lingkungan kampus. Pengunjung dapat menjelajahi laporan, menyaring hasil, membaca detail, dan menghubungi pelapor.

## Daftar Isi

- [Fitur](#fitur)
- [Spesifikasi Sistem](docs/SRS.md)
- [Tampilan dan Gerak](#tampilan-dan-gerak)
- [Teknologi](#teknologi)
- [Menjalankan Website](#menjalankan-website)
- [Cara Menggunakan](#cara-menggunakan)
- [Dashboard Admin](#dashboard-admin)
- [Struktur Berkas](#struktur-berkas)
- [Format Data](#format-data)
- [Penyimpanan dan Privasi](#penyimpanan-dan-privasi)
- [Pemecahan Masalah](#pemecahan-masalah)

## Fitur

- Beranda dengan ringkasan jumlah laporan, barang hilang, dan barang ditemukan. Angka dihitung dari data yang berhasil dimuat.
- Papan laporan dengan pencarian nama barang serta filter kategori dan status yang dapat digunakan bersamaan.
- Kartu laporan responsif. Pilih kartu dengan mouse atau keyboard untuk membuka detail dan kontak pelapor.
- Form laporan untuk kategori Elektronik, Dokumen, Tas, Kunci, Aksesori, Pakaian, dan Lainnya.
- Foto barang opsional pada form publik. Foto JPG, PNG, atau WebP maksimal 8 MB diperkecil otomatis hingga sisi terpanjang 1600 px dengan rasio asli; hasil JPEG quality 0.84 ditampilkan utuh pada kartu/detail publik dan galeri admin.
- Validasi kolom wajib, nama minimal 3 karakter, kontak berupa email atau nomor HP, dan tanggal kejadian yang tidak melewati hari ini.
- Pesan kesalahan di dekat kolom, notifikasi setelah pengiriman, entrance hero/admin dan reveal halus saat bagian halaman masuk viewport. Transisi kartu, tombol, serta dukungan `prefers-reduced-motion` menjaga gerak tetap lembut dan dapat dikurangi.
- Server membaca dan menyimpan daftar laporan di `data/reports.json`. Laporan yang dikirim dari publik atau diubah admin langsung dibaca kembali oleh kedua halaman.
- Foto laporan disimpan sebagai berkas JPEG di `assets/images/lost/` atau `assets/images/found/` sesuai statusnya. Mengubah status memindahkan foto; menghapus laporan ikut menghapus foto.
- Dashboard admin terpisah dengan ringkasan, filter daftar, pengelompokan status, galeri foto, edit/hapus, dan cetak laporan. Gradien status, animasi masuk bertahap, dan transisi hover/tekan melengkapi tampilannya; preferensi reduced-motion tetap dihormati.
- Konfirmasi setelah pengiriman laporan mengarahkan pelapor untuk memeriksa status secara berkala. Dashboard memisahkan tanggal kejadian dan tanggal terakhir diperbarui.
- Menu Kelola admin dapat mendaftarkan beberapa akun demo dan menampilkan daftar admin pada browser yang sama.

## Tampilan dan Gerak

> Website menggunakan animasi singkat untuk memberi respons yang terasa hidup tanpa menghambat aktivitas pengguna:

- Saat website publik dibuka, navigasi dan area utama beranda muncul dengan fade/gerak masuk ringan.
- Saat halaman digulir, ringkasan, filter, formulir, dan bagian Tentang Kami muncul bertahap ketika masuk ke viewport. Kartu laporan juga memiliki fade-in serta respons hover.
- Dashboard admin menampilkan login dan panel melalui entrance halus; metrik masuk bertahap, sedangkan menu dan tombol memberi respons saat diarahkan atau ditekan.
- Modal detail memakai fade dan scale ringan. Foto tetap menjaga rasio dan tidak ikut bergerak berlebihan.
- Jika perangkat mengaktifkan `prefers-reduced-motion`, reveal saat scroll dilewati dan durasi animasi/transisi dipersingkat. Seluruh konten tetap terlihat.

Animasi dibuat dengan CSS dan `IntersectionObserver` bawaan browser, tanpa library tambahan.

## Teknologi

Website dibuat dengan HTML, CSS, dan JavaScript murni tanpa proses build atau framework. Google Fonts digunakan untuk tipografi; jika font eksternal tidak tersedia, browser memakai font cadangan.

## Menjalankan Website

`fetch()` membutuhkan halaman yang dilayani melalui HTTP. Membuka `index.html` langsung menggunakan alamat `file://` dapat menyebabkan browser menolak pembacaan `data.json`.

### Dengan Node.js (penyimpanan permanen)

Gunakan Node.js 18 atau lebih baru. Dari direktori proyek, jalankan:

```powershell
node server.js
```

Kemudian buka `http://localhost:3000` untuk publik atau `http://localhost:3000/admin/` untuk admin. Hentikan server dengan `Ctrl+C`. Server ini menggunakan modul bawaan Node, tanpa instalasi paket tambahan.

Publik dan admin memakai API serta data server yang sama. Saat pertama dijalankan, server membuat folder `data/` bila belum ada. Jangan jalankan publik/admin melalui port berbeda.

### Pratinjau statis saja

`python -m http.server 8000` atau Live Server hanya bisa menampilkan halaman dan data contoh. Mode itu tidak menyediakan API untuk menyimpan laporan/foto ke disk; form akan memberi tahu jika server Node tidak aktif.

Halaman admin tidak ditautkan dari navigasi publik. Buka `http://localhost:3000/admin/` setelah `node server.js` aktif.

## Cara Menggunakan

### Mencari barang

1. Buka bagian **Laporan**.
2. Ketik nama barang dan, bila perlu, pilih kategori serta status.
3. Pilih kartu yang sesuai untuk membaca lokasi, tanggal, deskripsi, dan kontak.
4. Hubungi pelapor untuk mencocokkan ciri barang dan mengatur pengembalian dengan aman.

### Membuat laporan

1. Buka **Lapor Barang**.
2. Pilih status **Hilang** atau **Ditemukan**, lalu isi seluruh kolom wajib.
3. Periksa bahwa tanggal bukan tanggal mendatang dan kontak dapat dihubungi.
4. Kirim laporan. Server menyimpan laporan di `data/reports.json`; publik dan dashboard membaca data yang sama.

## Dashboard Admin

### Akun demo

- Nama pengguna: `admin`
- Kata sandi: `campus123`

Buka `/admin/` pada server Node, lalu masuk menggunakan akun demo tersebut. Menu Ringkasan menampilkan statistik dan laporan terbaru. Menu Semua laporan, Barang hilang, dan Barang ditemukan menyediakan pencarian, filter status, serta aksi edit, cetak, dan hapus. Menu Galeri foto menampilkan gambar berdasarkan status.

### Mengelola admin dan tanggal laporan

1. Buka menu **Kelola admin**, isi username (3–24 karakter), kata sandi (minimal 8 karakter), dan konfirmasinya, lalu pilih **Tambah admin**.
2. Akun tambahan dapat dipakai untuk login pada origin/browser yang sama. Admin aktif tidak dapat menghapus dirinya sendiri; akun admin terakhir juga tidak dapat dihapus.
3. Tabel laporan menampilkan tanggal kejadian dan tanggal terakhir diperbarui. Perubahan pertama melalui editor admin akan mencatat `updatedAt`; laporan contoh lama yang belum pernah diedit menampilkan **Belum diperbarui** karena histori sebelumnya tidak tersedia.

Akun tambahan disimpan di `localStorage` pada kunci `lostFoundCampusAdminUsers`. Kata sandi tersimpan sebagai teks biasa di browser. Fitur ini hanya untuk demo dan tidak boleh dipakai sebagai kontrol akses produksi; gunakan backend dan penyimpanan kata sandi yang di-hash untuk penggunaan nyata.

### Mengedit dan mencetak

1. Pilih **Edit** pada laporan dari ringkasan atau daftar.
2. Perbarui informasi. Pilih foto JPG, PNG, atau WebP maksimal 8 MB; browser mengecilkan gambar, lalu server menyimpannya pada folder status.
3. Simpan perubahan. Server memperbarui `data/reports.json`; tab publik dan admin memuat data yang sama.
4. Gunakan ikon cetak pada baris laporan untuk mencetak detail individual, atau tombol **Cetak daftar** untuk mencetak tabel.

Perubahan edit, status, dan penghapusan ditulis ke `data/reports.json`. Foto unggahan ditulis ke folder status yang sesuai. Server akan mengirim perubahan itu ke publik dan admin pada permintaan berikutnya; tab lain pada origin yang sama juga diberi sinyal untuk memuat ulang data.

### Batas keamanan

Login dan kata sandi demo berada di JavaScript sisi browser. Ini hanya gerbang tampilan untuk demonstrasi, bukan autentikasi aman: pengguna dapat membaca kredensial dari kode atau mengubah penyimpanan browser. Jangan gunakan untuk data nyata/rahasia. Untuk penggunaan produksi, pindahkan autentikasi, otorisasi, data, dan unggahan foto ke backend dengan database dan penyimpanan file.

Halaman admin memakai `noindex` dan tidak memiliki tautan dari website publik, tetapi login demo masih berada di sisi browser. `server.js` mengikat ke `127.0.0.1` untuk pemakaian lokal; jangan mengekspos server/API ke jaringan publik sebelum menambahkan autentikasi dan otorisasi server-side.

## Struktur Berkas

| Berkas/folder          | Kegunaan                                                                         |
| ---------------------- | -------------------------------------------------------------------------------- |
| `index.html`           | Website publik: navigasi, beranda, laporan, form, dan detail.                    |
| `style.css`            | Gaya website publik, kartu, foto, modal, dan tata letak responsif.               |
| `script.js`            | Memuat, mencari/filter, validasi, merender laporan, dan membaca perubahan admin. |
| `data.json`            | Sumber enam laporan contoh awal.                                                 |
| `data/reports.json`    | Database file-based yang dibaca dan diperbarui oleh `server.js`.                 |
| `server.js`            | Server HTTP, API laporan, dan penulisan foto/data ke disk menggunakan Node.js.   |
| `docs/SRS.md`          | Spesifikasi kebutuhan, alur sistem, API, kamus data, dan peta fungsi kode.       |
| `admin/index.html`     | Halaman login dan struktur dashboard admin.                                      |
| `assets/css/admin.css` | Gaya login, dashboard, tabel, galeri, modal edit, dan cetak.                     |
| `assets/js/admin.js`   | Login demo, ringkasan, pengelolaan laporan, foto, dan cetak.                     |
| `assets/images/lost/`  | Folder untuk aset foto statis kategori barang hilang.                            |
| `assets/images/found/` | Folder untuk aset foto statis kategori barang ditemukan.                         |

Browser tidak menulis langsung ke folder. Form publik dan dashboard mengirim foto terkompresi ke `server.js`; server yang menulis file JPEG ke folder status dan path-nya ke `data/reports.json`.

## Format Data

Setiap item dalam `data.json` memakai bentuk berikut:

```json
{
  "id": "sample-1",
  "name": "Dompet kulit cokelat",
  "category": "Aksesori",
  "status": "Hilang",
  "location": "Perpustakaan lantai 2",
  "date": "2026-10-10",
  "description": "Dompet kulit warna cokelat dengan ciri khusus.",
  "contact": "mahasiswa@kampus.ac.id"
}
```

`status` harus bernilai `Hilang` atau `Ditemukan`. Tanggal menggunakan format `YYYY-MM-DD`. Kategori harus sesuai dengan pilihan kategori pada form agar filter dan ikon kartu konsisten. Pastikan JSON tetap valid setelah mengubah data.

## Penyimpanan dan Privasi

Laporan dan foto tersimpan di file pada komputer yang menjalankan `server.js`, tidak di `localStorage`. Karena server mengikat ke `127.0.0.1`, data dapat dipakai bersama oleh publik/admin pada komputer tersebut. Untuk diakses perangkat lain, perlu konfigurasi hosting/jaringan dan autentikasi server yang sesuai. Akun admin demo saat ini masih disimpan di `localStorage` dan bukan autentikasi produksi.

Kontak laporan ditampilkan kepada pengunjung yang membuka detail. Jangan masukkan kata sandi, nomor identitas, atau informasi sensitif lain; gunakan kontak yang memang bersedia dibagikan.

## Pemecahan Masalah

- **Form memberi tahu server tidak aktif:** jalankan `node server.js` dari folder proyek, lalu buka publik/admin melalui port `3000`.
- **Perubahan laporan tidak terlihat:** pastikan halaman dibuka dari origin Node yang sama dan periksa `data/reports.json`.
- **Login admin tidak dianggap aman:** akun pada versi ini hanya untuk demonstrasi. Jangan mempublikasikan kata sandi yang digunakan ulang pada akun sungguhan.
- **Foto gagal disimpan:** pastikan file berformat JPG, PNG, atau WebP, ukurannya tidak lebih dari 8 MB, dan Node memiliki izin menulis ke folder proyek.
- **Foto laporan publik tidak terlihat di admin:** pastikan request menggunakan server Node yang sama dan file ada di folder `assets/images/lost/` atau `assets/images/found/`.
- **Laporan buatan pengguna hilang:** periksa apakah data situs/browser telah dibersihkan atau halaman dibuka menggunakan profil browser lain.
- **Font berbeda:** website tetap dapat digunakan tanpa koneksi Google Fonts; browser akan menggunakan font cadangan.
#   L o s t - F o u n d - C a m p u s - U T S  
 