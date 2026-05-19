# 📚 Tutorial Deployment — Portal Pengumuman Kelulusan
## SMP Negeri 30 Semarang | Versi 2.0

---

## 📁 Struktur File

```
pengumuman-sekolah/
├── index.html     ← Halaman login + surat resmi kelulusan
├── style.css      ← Tampilan modern + CSS print A4 profesional
├── script.js      ← Login, validasi, anti-spam, format data
├── Code.gs        ← Google Apps Script (backend/API)
└── TUTORIAL.md    ← File ini
```

---

## 🗂️ LANGKAH 1 — Buat Google Spreadsheet

### 1.1 Buat spreadsheet baru
1. Buka [sheets.google.com](https://sheets.google.com)
2. Klik **"+ Blank"**
3. Beri nama: **"Data Kelulusan SMP Negeri 30 Semarang"**

### 1.2 Header kolom — baris pertama (WAJIB persis seperti ini)

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| `nisn` | `nik` | `nama` | `tempat_lahir` | `tanggal_lahir` | `jk` | `kelas` | `nomor_ujian` | `angkatan` | `status` | `pesan` |

> ⚠️ **Penting:** Huruf kecil semua, gunakan garis bawah `_`, tanpa spasi

### 1.3 Contoh isi data

| nisn | nik | nama | tempat_lahir | tanggal_lahir | jk | kelas | nomor_ujian | angkatan | status | pesan |
|------|-----|------|--------------|---------------|----|-------|-------------|----------|--------|-------|
| 0098765432 | 3374000000000001 | Budi Santoso | Semarang | 2011-03-22 | L | IX A | 24-001-008 | 2026 | LULUS | Selamat atas kelulusannya! |
| 0011223344 | 3374000000000002 | Siti Rahayu | Semarang | 2011-07-10 | P | IX B | 24-002-015 | 2026 | LULUS | Selamat atas kelulusannya dengan nilai memuaskan. |
| 0055667788 | 3374000000000003 | Andi Wijaya | Demak | 2011-11-05 | L | IX C | 24-003-022 | 2026 | TIDAK LULUS | Silakan hubungi wali kelas untuk informasi selanjutnya. |

**Ketentuan kolom:**
- `nisn` — 10 digit angka, **tanpa tanda kutip** (format sel: Plain Text)
- `nik` — 16 digit angka, **tanpa tanda kutip** (format sel: Plain Text)
- `tanggal_lahir` — format `YYYY-MM-DD` (format sel: Plain Text, bukan Date)
- `jk` — isi `L` untuk Laki-laki, `P` untuk Perempuan
- `status` — isi `LULUS` atau `TIDAK LULUS`

> 💡 **Tips:** Untuk kolom NISN dan NIK, pilih kolom → Format → Number → **Plain Text** agar angka 0 di depan tidak hilang

### 1.4 Salin Spreadsheet ID
Dari URL spreadsheet:
```
https://docs.google.com/spreadsheets/d/[SALIN_BAGIAN_INI]/edit
```

---

## ⚙️ LANGKAH 2 — Setup Google Apps Script

### 2.1 Buka Apps Script
Di spreadsheet → klik **Extensions → Apps Script**

### 2.2 Paste kode
1. Hapus semua kode default (`Ctrl+A` → `Delete`)
2. Copy seluruh isi `Code.gs`
3. Paste ke editor

### 2.3 Isi Spreadsheet ID
Cari baris:
```javascript
SPREADSHEET_ID: 'GANTI_DENGAN_SPREADSHEET_ID_ANDA',
```
Ganti dengan ID spreadsheet Anda:
```javascript
SPREADSHEET_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
```

### 2.4 Test sebelum deploy (disarankan)
1. Di dropdown fungsi, pilih **`testHeaderKolom`** → klik ▶ Run
2. Lihat **Execution log** → harus muncul nama semua kolom
3. Edit fungsi `testLogin()`, ganti NISN dan NIK dengan data nyata dari spreadsheet
4. Jalankan `testLogin()` → harus muncul data siswa

---

## 🚀 LANGKAH 3 — Deploy Web App

1. Klik **"Deploy"** → **"New deployment"**
2. Klik ⚙️ → pilih **"Web app"**
3. Isi:

| Field | Nilai |
|-------|-------|
| Description | Portal Kelulusan SMPN30 v2 |
| Execute as | **Me** |
| Who has access | **Anyone** |

4. Klik **"Deploy"**
5. Otorisasi akses → Allow
6. **Salin URL Web App** (format: `https://script.google.com/macros/s/.../exec`)

---

## 🔗 LANGKAH 4 — Hubungkan ke Website

### Edit `script.js`:
```javascript
API_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
```

### Sesuaikan nomor surat (opsional):
```javascript
NOMOR_SURAT_PREFIX: '421.3/',
NOMOR_SURAT_SUFFIX: '/2026',
```

---

## 🌐 LANGKAH 5 — Upload ke Hosting

### Opsi A: Netlify Drop (Termudah, Gratis)
1. Buka [netlify.com/drop](https://app.netlify.com/drop)
2. Drag & drop **folder** `pengumuman-sekolah/`
3. Dapatkan URL publik → selesai!

### Opsi B: GitHub Pages → Embed Google Sites
1. Push folder ke repository GitHub
2. Settings → Pages → Source: main
3. URL: `https://username.github.io/nama-repo/`
4. Di Google Sites: Insert → Embed → masukkan URL + `?embed=1`

### Opsi C: Hosting Sekolah / cPanel
Upload 4 file ke `public_html/pengumuman/`

---

## 🖨️ Fitur Cetak / Save PDF

Tombol **"Cetak / Simpan PDF"** membuka dialog print browser.

**Cara save sebagai PDF:**
- Chrome/Edge: Printer → **"Save as PDF"**
- Firefox: Print → **"Save to PDF"**

**Format cetak otomatis:**
- Ukuran kertas: A4 Portrait
- Margin: 2.5cm atas, 2cm kanan, 2cm bawah, 3cm kiri (standar surat dinas)
- Header/footer website: **tersembunyi otomatis**
- Tombol: **tidak ikut tercetak**
- Kop surat: tampil lengkap dan rapi

---

## 🔐 Alur Keamanan Login

```
Siswa input NISN + Password (NIK)
         ↓
Validasi format di browser (realtime)
  - NISN: tepat 10 digit angka
  - NIK: tepat 16 digit angka
         ↓
Anti-spam check
  - Cooldown 4 detik antar request
  - Lock 2 menit setelah 5x gagal
         ↓
Request ke Google Apps Script
         ↓
Apps Script: cari NISN di spreadsheet
  → Jika tidak ada: not_found
  → Jika ada, cocokkan NIK:
    → NIK salah: not_found (tidak bocorkan info)
    → NIK cocok: kirim data (TANPA NIK)
         ↓
Browser tampilkan surat resmi
NIK tidak pernah ditampilkan di halaman
```

---

## 🔄 Update Data Siswa

Cukup edit Google Spreadsheet — langsung aktif tanpa deploy ulang.

Jika mengubah kode Apps Script:
- Deploy → Manage deployments → Edit → New version → Deploy

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| "Gagal terhubung ke server" | Periksa API_URL di script.js; coba buka URL-nya langsung di browser |
| Data tidak ditemukan padahal ada | Pastikan format NISN/NIK di spreadsheet adalah Plain Text, bukan angka |
| Tanggal lahir tampil salah | Pastikan format kolom tanggal_lahir di spreadsheet adalah Plain Text: `2011-03-22` |
| Kolom tidak ditemukan | Jalankan `testHeaderKolom()` di Apps Script untuk cek nama kolom |
| NISN hilang angka 0 di depan | Format kolom NISN di spreadsheet ke Plain Text |
| PDF terpotong | Pastikan margin printer diset ke "None" atau "Minimum" |

---

## 📋 Contoh Format Spreadsheet Lengkap (copy-paste siap pakai)

```
nisn	nik	nama	tempat_lahir	tanggal_lahir	jk	kelas	nomor_ujian	angkatan	status	pesan
0098765432	3374000000000001	Budi Santoso	Semarang	2011-03-22	L	IX A	24-001-008	2026	LULUS	Selamat atas kelulusannya!
0011223344	3374000000000002	Siti Rahayu	Semarang	2011-07-10	P	IX B	24-002-015	2026	LULUS	Selamat atas kelulusannya dengan nilai memuaskan.
```

*Pisahkan kolom dengan Tab saat paste ke Google Sheets.*

---

*Portal Pengumuman Kelulusan — SMP Negeri 30 Semarang*
*Versi 2.0 | 2026*
