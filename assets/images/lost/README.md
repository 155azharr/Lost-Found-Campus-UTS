# Foto Barang Hilang

Foto laporan berstatus `Hilang` disimpan otomatis oleh `server.js` pada folder ini. Server memperkecil unggahan menjadi JPEG dan memakai ID laporan sebagai nama berkas. Kolom `photo` pada `data/reports.json` menunjuk ke lokasi fotonya.

Jangan pindahkan atau mengganti nama foto secara manual selama laporannya masih aktif. Saat status laporan berubah menjadi `Ditemukan`, server memindahkan foto ke folder `assets/images/found/`; saat laporan dihapus, foto terkait ikut dihapus.
