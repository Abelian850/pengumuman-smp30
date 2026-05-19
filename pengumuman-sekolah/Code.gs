// ===================================================
// PORTAL PENGUMUMAN KELULUSAN — SMP Negeri 30 Semarang
// Code.gs  |  Google Apps Script Backend  |  Versi 2.0
// ===================================================
//
// CARA DEPLOY:
// 1. Extensions → Apps Script → paste kode ini
// 2. Isi SPREADSHEET_ID di bawah
// 3. Deploy → New deployment → Web App
//    Execute as: Me | Who has access: Anyone
// ===================================================

// =====================================================
// ⚙️ KONFIGURASI — WAJIB DIISI
// =====================================================
const GAS_CONFIG = {
  // 🔑 ID Google Spreadsheet Anda
  // URL: docs.google.com/spreadsheets/d/[ID_INI]/edit
  SPREADSHEET_ID: 'GANTI_DENGAN_SPREADSHEET_ID_ANDA',

  // 📋 Nama sheet (tab)
  SHEET_NAME: 'Data Siswa',

  // 📌 Baris header (biasanya 1)
  HEADER_ROW: 1,
};

// =====================================================
// NAMA KOLOM — harus cocok dengan header spreadsheet
// =====================================================
const COL = {
  NISN:          'nisn',
  NIK:           'nik',           // digunakan sebagai password
  NAMA:          'nama',
  TEMPAT_LAHIR:  'tempat_lahir',
  TANGGAL_LAHIR: 'tanggal_lahir', // format YYYY-MM-DD
  JK:            'jk',            // L atau P
  KELAS:         'kelas',
  NOMOR_UJIAN:   'nomor_ujian',
  ANGKATAN:      'angkatan',
  STATUS:        'status',
  PESAN:         'pesan',
};

// =====================================================
// HANDLER GET — titik masuk semua request
// =====================================================
function doGet(e) {
  const out = ContentService
    .createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);

  try {
    if (!e || !e.parameter) {
      return kirimJSON(out, { status: 'error', message: 'Parameter tidak valid' });
    }

    const action = (e.parameter.action || '').toLowerCase();
    const nisn   = (e.parameter.nisn   || '').trim();
    const nik    = (e.parameter.nik    || '').trim();

    if (action !== 'login') {
      return kirimJSON(out, { status: 'error', message: 'Action tidak dikenal' });
    }

    // Validasi format input
    if (!/^\d{10}$/.test(nisn)) {
      return kirimJSON(out, { status: 'error', message: 'Format NISN tidak valid' });
    }
    if (!/^\d{16}$/.test(nik)) {
      return kirimJSON(out, { status: 'error', message: 'Format NIK tidak valid' });
    }

    // Cari dan verifikasi
    const hasil = cariDanVerifikasi(nisn, nik);
    return kirimJSON(out, hasil);

  } catch (err) {
    console.error('doGet error:', err.toString());
    return kirimJSON(out, { status: 'error', message: 'Terjadi kesalahan pada server' });
  }
}

// =====================================================
// CARI + VERIFIKASI NISN & NIK
// =====================================================
function cariDanVerifikasi(nisn, nik) {
  const ss    = SpreadsheetApp.openById(GAS_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(GAS_CONFIG.SHEET_NAME);

  if (!sheet) {
    console.error('Sheet tidak ditemukan:', GAS_CONFIG.SHEET_NAME);
    return { status: 'error', message: 'Data tidak tersedia' };
  }

  const data    = sheet.getDataRange().getValues();
  const headers = data[GAS_CONFIG.HEADER_ROW - 1]
    .map(h => h.toString().toLowerCase().trim().replace(/\s+/g, '_'));

  const idxNISN = headers.indexOf(COL.NISN);
  const idxNIK  = headers.indexOf(COL.NIK);

  if (idxNISN === -1 || idxNIK === -1) {
    console.error('Kolom NISN atau NIK tidak ditemukan. Headers:', headers);
    return { status: 'error', message: 'Konfigurasi kolom tidak sesuai' };
  }

  // Cari baris yang cocok NISN-nya
  for (let i = GAS_CONFIG.HEADER_ROW; i < data.length; i++) {
    const row      = data[i];
    const nisnBaris = row[idxNISN].toString().trim();

    if (nisnBaris !== nisn) continue;

    // NISN cocok — verifikasi NIK (password)
    const nikBaris = row[idxNIK].toString().trim();
    if (nikBaris !== nik) {
      // NISN ada tapi NIK salah → tetap kembalikan not_found (tidak bocorkan info)
      return { status: 'not_found' };
    }

    // ✅ NISN & NIK cocok — bangun objek data siswa
    const siswa = {};
    Object.entries(COL).forEach(([key, kolom]) => {
      const idx = headers.indexOf(kolom);
      // ⚠️ NIK TIDAK dikirim ke frontend
      if (kolom === COL.NIK) return;
      siswa[kolom] = idx !== -1 ? row[idx].toString().trim() : '';
    });

    // Format tanggal jika tersimpan sebagai Date object
    if (siswa[COL.TANGGAL_LAHIR]) {
      const raw = row[headers.indexOf(COL.TANGGAL_LAHIR)];
      if (raw instanceof Date) {
        const y = raw.getFullYear();
        const m = String(raw.getMonth() + 1).padStart(2, '0');
        const d = String(raw.getDate()).padStart(2, '0');
        siswa[COL.TANGGAL_LAHIR] = `${y}-${m}-${d}`;
      }
    }

    return { status: 'found', siswa };
  }

  // NISN tidak ditemukan sama sekali
  return { status: 'not_found' };
}

// =====================================================
// HELPER RESPONS JSON
// =====================================================
function kirimJSON(out, data) {
  out.setContent(JSON.stringify(data));
  return out;
}

// =====================================================
// HANDLER POST (untuk keamanan tambahan)
// =====================================================
function doPost(e) {
  return doGet(e);
}

// =====================================================
// FUNGSI TEST — Jalankan di Apps Script Editor
// =====================================================

/**
 * Test: tampilkan nama kolom yang terdeteksi
 */
function testHeaderKolom() {
  const ss      = SpreadsheetApp.openById(GAS_CONFIG.SPREADSHEET_ID);
  const sheet   = ss.getSheetByName(GAS_CONFIG.SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('Headers ditemukan: ' + headers.map(h => `"${h}"`).join(', '));
}

/**
 * Test: cari siswa dengan NISN + NIK tertentu
 * Ganti nilainya sesuai data di spreadsheet Anda
 */
function testLogin() {
  const hasil = cariDanVerifikasi('0098765432', '3374XXXXXXXXXXXX');
  Logger.log(JSON.stringify(hasil, null, 2));
}

/**
 * Test: simulasi request GET lengkap
 */
function testDoGet() {
  const fakeE = {
    parameter: {
      action: 'login',
      nisn:   '0098765432',
      nik:    '3374XXXXXXXXXXXX',
    }
  };
  const out = doGet(fakeE);
  Logger.log(out.getContent());
}
