/* ===================================================
   PORTAL PENGUMUMAN KELULUSAN — SMP Negeri 30 Semarang
   script.js  |  Versi 2.0
   =================================================== */

'use strict';

// =====================================================
// ⚙️ KONFIGURASI — UBAH SESUAI KEBUTUHAN
// =====================================================
const CONFIG = {
  // 🔗 Ganti dengan URL Web App Google Apps Script setelah deploy
  API_URL: 'https://script.google.com/macros/s/AKfycbx2eXcgKV0ZFgs0F8hiKS-ArejlleLH3ePOU9V2GwaTHGCmvuP_XhBs4cMu8Z7H/exec',

  // ⏱️ Anti-spam: jeda antar request (ms)
  COOLDOWN_MS: 4000,

  // 🔒 Batas gagal login sebelum dikunci
  MAX_FAIL: 5,
  LOCKOUT_MS: 120000, // 2 menit

  // 📄 Nomor surat (bisa diisi manual atau dari spreadsheet)
  NOMOR_SURAT_PREFIX: '421.3/',
  NOMOR_SURAT_SUFFIX: '/2026',
};

// =====================================================
// STATE
// =====================================================
let failCount   = 0;
let lockedUntil = 0;
let lastRequest = 0;
let isRequesting= false;
let lockTimer   = null;

// =====================================================
// HELPERS DOM
// =====================================================
const $ = id => document.getElementById(id);

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  $('footerYear').textContent = new Date().getFullYear();
  initDarkMode();
  initPasswordToggle();
  initRealtimeValidation();
  initLoginButton();
  isDemoMode() && showDemoBanner();
});

// =====================================================
// DARK MODE
// =====================================================
function initDarkMode() {
  const saved = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(saved);
  $('darkModeToggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
  });
}
function setTheme(t) { document.documentElement.setAttribute('data-theme', t); }

// =====================================================
// PASSWORD TOGGLE
// =====================================================
function initPasswordToggle() {
  const btn    = $('togglePw');
  const input  = $('inputPassword');
  const eyeOn  = btn.querySelector('.icon-eye');
  const eyeOff = btn.querySelector('.icon-eye-off');

  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eyeOn.style.display  = show ? 'none' : 'block';
    eyeOff.style.display = show ? 'block' : 'none';
    btn.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
  });
}

// =====================================================
// REALTIME VALIDASI INPUT
// =====================================================
function initRealtimeValidation() {
  const nisnInput = $('inputNISN');
  const pwInput   = $('inputPassword');

  // Hanya izinkan angka
  nisnInput.addEventListener('input', () => {
    nisnInput.value = nisnInput.value.replace(/\D/g, '');
    validateNISN();
  });
  pwInput.addEventListener('input', () => {
    pwInput.value = pwInput.value.replace(/\D/g, '');
    validatePW();
  });

  // Enter → submit
  [nisnInput, pwInput].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
}

function validateNISN() {
  const val = $('inputNISN').value;
  const ok  = /^\d{10}$/.test(val);
  setFieldState('inputNISN', 'nisnHint', 'nisnOk', ok,
    ok ? 'NISN valid ✓' : (val.length > 0 ? `${val.length}/10 digit` : 'Masukkan 10 digit NISN Anda'));
  return ok;
}
function validatePW() {
  const val = $('inputPassword').value;
  const ok  = /^\d{16}$/.test(val);
  setFieldState('inputPassword', 'pwHint', 'pwOk', ok,
    ok ? 'Password valid ✓' : (val.length > 0 ? `${val.length}/16 digit` : 'Masukkan 16 digit NIK sesuai KK/KTP'));
  return ok;
}

function setFieldState(inputId, hintId, okId, isOk, msg) {
  const input = $(inputId);
  const hint  = $(hintId);
  const okEl  = $(okId);
  const hasVal = input.value.length > 0;

  input.classList.toggle('is-valid', isOk);
  input.classList.toggle('is-error', hasVal && !isOk);

  hint.textContent = msg;
  hint.className   = 'field-hint' + (hasVal && !isOk ? ' is-error' : '');
  if (okEl) okEl.style.display = isOk ? 'flex' : 'none';
}

function clearFieldErrors() {
  ['inputNISN', 'inputPassword'].forEach(id => {
    $(id).classList.remove('is-error', 'is-valid');
  });
  $('nisnHint').textContent = 'Masukkan 10 digit NISN Anda';
  $('pwHint').textContent   = 'Masukkan 16 digit NIK sesuai KK/KTP';
  ['nisnHint','pwHint'].forEach(id => $(id).className = 'field-hint');
  ['nisnOk','pwOk'].forEach(id => $(id).style.display = 'none');
}

// =====================================================
// LOGIN BUTTON INIT
// =====================================================
function initLoginButton() {
  $('loginBtn').addEventListener('click', doLogin);
}

// =====================================================
// ANTI-SPAM CHECK
// =====================================================
function checkSpam() {
  const now = Date.now();

  if (now < lockedUntil) {
    const sisa = Math.ceil((lockedUntil - now) / 1000);
    tampilkanLock(`Akses dikunci. Coba lagi dalam ${sisa} detik.`);
    return false;
  }

  if (now - lastRequest < CONFIG.COOLDOWN_MS) {
    const sisa = Math.ceil((CONFIG.COOLDOWN_MS - (now - lastRequest)) / 1000);
    tampilkanLock(`Mohon tunggu ${sisa} detik sebelum mencoba lagi.`);
    return false;
  }

  return true;
}

function tampilkanLock(pesan) {
  $('lockWarning').style.display = 'flex';
  $('lockMsg').textContent = pesan;
}
function sembunyikanLock() {
  $('lockWarning').style.display = 'none';
}

// =====================================================
// MAIN LOGIN
// =====================================================
async function doLogin() {
  if (isRequesting) return;
  sembunyikanLock();
  sembunyikanError();

  const nisn = $('inputNISN').value.trim();
  const pw   = $('inputPassword').value.trim();

  // Validasi
  const nisnOk = validateNISN();
  const pwOk   = validatePW();
  if (!nisnOk || !pwOk) return;

  // Anti-spam
  if (!checkSpam()) return;

  // Mulai request
  isRequesting = true;
  lastRequest  = Date.now();
  setLoading(true);
  sembunyikanSurat();

  try {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set('action', 'login');
    url.searchParams.set('nisn',   nisn);
    url.searchParams.set('nik',    pw);   // NIK dikirim sebagai password

    const res  = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    setLoading(false);
    isRequesting = false;

    if (data.status === 'found') {
      failCount = 0;
      sembunyikanLock();
      tampilkanSurat(data.siswa);
    } else {
      failCount++;
      if (failCount >= CONFIG.MAX_FAIL) {
        lockedUntil = Date.now() + CONFIG.LOCKOUT_MS;
        failCount   = 0;
        mulaiHitungMundur();
      }
      tampilkanError();
    }

  } catch (err) {
    setLoading(false);
    isRequesting = false;
    console.error('Login error:', err);
    $('lockWarning').style.display = 'flex';
    $('lockMsg').textContent = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
  }
}

// ===== HITUNG MUNDUR LOCKOUT =====
function mulaiHitungMundur() {
  if (lockTimer) clearInterval(lockTimer);
  lockTimer = setInterval(() => {
    const sisa = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (sisa <= 0) {
      clearInterval(lockTimer);
      sembunyikanLock();
      return;
    }
    tampilkanLock(`Terlalu banyak percobaan gagal. Akses dikunci ${sisa} detik.`);
  }, 1000);
}

// =====================================================
// LOADING
// =====================================================
function setLoading(on) {
  $('loadingOverlay').style.display = on ? 'flex' : 'none';
  const btn = $('loginBtn');
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}

// =====================================================
// TAMPILKAN / SEMBUNYIKAN SURAT
// =====================================================
function tampilkanSurat(s) {
  // Format tanggal lahir: YYYY-MM-DD → DD Bulan YYYY
  const ttl = `${s.tempat_lahir || '—'}, ${formatTanggal(s.tanggal_lahir)}`;

  // Format jenis kelamin
  const jk = formatJK(s.jk);

  // Isi data
  $('sNama').textContent       = (s.nama || '—').toUpperCase();
  $('sTTL').textContent        = ttl;
  $('sJK').textContent         = jk;
  $('sNISN').textContent       = s.nisn           || '—';
  $('sNomorUjian').textContent = s.nomor_ujian     || '—';
  $('sKelas').textContent      = s.kelas           || '—';
  $('sAngkatan').textContent   = s.angkatan        || '2026';
  $('suratAngkatan').textContent = s.angkatan      || '2026';

  // Status
  const statusEl = $('sStatus');
  const kotakEl  = $('statusKotak');
  const statusRaw = (s.status || '').trim().toUpperCase();
  statusEl.textContent = statusRaw || '—';
  kotakEl.className    = 'status-kotak ' + getStatusClass(statusRaw);

  // Pesan
  const pesanWrap = $('suratPesanWrap');
  if (s.pesan && s.pesan.trim()) {
    $('sPesan').textContent    = s.pesan;
    pesanWrap.style.display    = 'block';
  } else {
    pesanWrap.style.display    = 'none';
  }

  // Nomor surat
  $('suratNomor').textContent = CONFIG.NOMOR_SURAT_PREFIX + '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0' + CONFIG.NOMOR_SURAT_SUFFIX;

  // Tanggal surat = hari ini
  const hariIni = formatTanggal(new Date().toISOString().slice(0, 10));
  $('suratTanggal').textContent = hariIni;
  $('ttdTanggal').textContent   = hariIni;

  // Tampilkan
  $('suratOuter').style.display = 'block';
  $('suratOuter').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Sembunyikan info cards saat surat tampil
  $('infoSection').style.display = 'none';
}

function sembunyikanSurat() {
  $('suratOuter').style.display  = 'none';
  $('infoSection').style.display = 'block';
}

function tampilkanError() {
  $('notifError').style.display = 'flex';
  $('notifError').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function sembunyikanError() {
  $('notifError').style.display = 'none';
}

// =====================================================
// FORMAT HELPERS
// =====================================================
const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];

function formatTanggal(str) {
  if (!str) return '—';
  // Dukung YYYY-MM-DD
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const tgl  = parseInt(m[3], 10);
    const bln  = parseInt(m[2], 10) - 1;
    const thn  = m[1];
    return `${tgl} ${BULAN_ID[bln]} ${thn}`;
  }
  return str;
}

function formatJK(kode) {
  if (!kode) return '—';
  const k = kode.toString().trim().toUpperCase();
  if (k === 'L') return 'Laki-Laki';
  if (k === 'P') return 'Perempuan';
  return kode;
}

function getStatusClass(status) {
  if (!status) return '';
  if (status.includes('LULUS') && !status.includes('TIDAK')) return 'status-lulus';
  if (status.includes('TIDAK') || status.includes('GAGAL'))   return 'status-tidak';
  return '';
}

// =====================================================
// CETAK PDF
// =====================================================
function cetakPDF() {
  window.print();
}

// =====================================================
// KEMBALI
// =====================================================
function kembali() {
  sembunyikanSurat();
  sembunyikanError();
  sembunyikanLock();
  clearFieldErrors();
  $('inputNISN').value     = '';
  $('inputPassword').value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => $('inputNISN').focus(), 400);
}

// =====================================================
// DEMO MODE — Aktif jika API_URL belum diganti
// =====================================================
function isDemoMode() {
  return CONFIG.API_URL.includes('GANTI_DENGAN');
}

function showDemoBanner() {
  // Override fetch untuk simulasi
  window.fetch = async (url) => {
    await new Promise(r => setTimeout(r, 1400));
    const params = new URL(url).searchParams;
    const nisn   = params.get('nisn');
    const nik    = params.get('nik');

    const db = {
      '0098765432': {
        nisn: '0098765432', nik: '337400000000002002',
        nama: 'Budi Santoso', tempat_lahir: 'Semarang',
        tanggal_lahir: '2011-03-22', jk: 'L',
        kelas: 'IX A', nomor_ujian: '24-001-008',
        angkatan: '2026', status: 'LULUS',
        pesan: 'Selamat atas kelulusannya! Harap hadir pada acara wisuda yang akan dijadwalkan kemudian.',
      },
      '0011223344': {
        nisn: '0011223344', nik: '337400000000001001',
        nama: 'Siti Rahayu', tempat_lahir: 'Semarang',
        tanggal_lahir: '2011-07-10', jk: 'P',
        kelas: 'IX B', nomor_ujian: '24-002-015',
        angkatan: '2026', status: 'LULUS',
        pesan: 'Selamat atas kelulusannya dengan nilai yang memuaskan.',
      },
    };

    const siswa = db[nisn];
    if (siswa && siswa.nik === nik) {
      return { ok: true, json: async () => ({ status: 'found', siswa }) };
    }
    return { ok: true, json: async () => ({ status: 'not_found' }) };
  };

  // Banner demo
  const banner = document.createElement('div');
  banner.style.cssText = [
    'background:#fef3c7', 'border-bottom:2px solid #f59e0b',
    'padding:10px 20px', 'text-align:center',
    'font-size:.8rem', 'color:#78350f', 'font-weight:600',
    'font-family:Plus Jakarta Sans,sans-serif', 'z-index:999',
    'position:relative',
  ].join(';');
  banner.innerHTML =
    '⚠️ <strong>MODE DEMO</strong> — ' +
    'NISN: <code style="background:#fde68a;padding:1px 6px;border-radius:4px">0098765432</code> ' +
    'Password: <code style="background:#fde68a;padding:1px 6px;border-radius:4px">337400000000002002</code>. ' +
    'Hubungkan ke Google Apps Script untuk data nyata.';
  document.body.insertAdjacentElement('afterbegin', banner);
}
