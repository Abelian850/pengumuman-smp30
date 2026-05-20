/* ===================================================
   PORTAL PENGUMUMAN KELULUSAN — SMP Negeri 30 Semarang
   script.js  |  Versi 3.0
   Alur: Login → Pengumuman Hasil → Surat PDF
   =================================================== */

'use strict';

// =====================================================
// ⚙️ KONFIGURASI
// =====================================================
const CONFIG = {
  API_URL:              'https://script.google.com/macros/s/AKfycbx2eXcgKV0ZFgs0F8hiKS-ArejlleLH3ePOU9V2GwaTHGCmvuP_XhBs4cMu8Z7H/exec',
  COOLDOWN_MS:          4000,
  MAX_FAIL:             5,
  LOCKOUT_MS:           120000,
  NOMOR_SURAT_PREFIX:   '421.3/',
  NOMOR_SURAT_SUFFIX:   '/2026',
  // Tanggal tanda tangan kepala sekolah untuk QR Code
  TTD_DATE: '26 Mei 2026',
};

// =====================================================
// STATE
// =====================================================
let failCount    = 0;
let lockedUntil  = 0;
let lastRequest  = 0;
let isRequesting = false;
let lockTimer    = null;
let dataSiswa    = null;  // simpan data siswa setelah login berhasil

// =====================================================
// DOM REFS
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
  $('loginBtn').addEventListener('click', doLogin);
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
    const show   = input.type === 'password';
    input.type   = show ? 'text' : 'password';
    eyeOn.style.display  = show ? 'none'  : 'block';
    eyeOff.style.display = show ? 'block' : 'none';
  });
}

// =====================================================
// REALTIME VALIDASI
// =====================================================
function initRealtimeValidation() {
  $('inputNISN').addEventListener('input', () => {
    $('inputNISN').value = $('inputNISN').value.replace(/\D/g, '');
    validateNISN();
  });
  $('inputPassword').addEventListener('input', () => {
    $('inputPassword').value = $('inputPassword').value.replace(/\D/g, '');
    validatePW();
  });
  [$('inputNISN'), $('inputPassword')].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); })
  );
}

function validateNISN() {
  const val = $('inputNISN').value;
  const ok  = /^\d{10}$/.test(val);
  setFieldState('inputNISN','nisnHint','nisnOk', ok,
    ok ? 'NISN valid ✓' : val.length > 0 ? `${val.length}/10 digit` : 'Masukkan 10 digit NISN Anda');
  return ok;
}
function validatePW() {
  const val = $('inputPassword').value;
  const ok  = /^\d{16}$/.test(val);
  setFieldState('inputPassword','pwHint','pwOk', ok,
    ok ? 'Password valid ✓' : val.length > 0 ? `${val.length}/16 digit` : 'Masukkan 16 digit NIK sesuai KK/KTP');
  return ok;
}
function setFieldState(inputId, hintId, okId, isOk, msg) {
  const input  = $(inputId);
  const hasVal = input.value.length > 0;
  input.classList.toggle('is-valid', isOk);
  input.classList.toggle('is-error', hasVal && !isOk);
  $(hintId).textContent = msg;
  $(hintId).className   = 'field-hint' + (hasVal && !isOk ? ' is-error' : '');
  $(okId).style.display = isOk ? 'flex' : 'none';
}
function clearFieldErrors() {
  ['inputNISN','inputPassword'].forEach(id => $(id).classList.remove('is-error','is-valid'));
  $('nisnHint').textContent = 'Masukkan 10 digit NISN Anda';
  $('pwHint').textContent   = 'Masukkan 16 digit NIK sesuai KK/KTP';
  ['nisnHint','pwHint'].forEach(id => $(id).className = 'field-hint');
  ['nisnOk','pwOk'].forEach(id => $(id).style.display = 'none');
}

// =====================================================
// ANTI-SPAM
// =====================================================
function checkSpam() {
  const now = Date.now();
  if (now < lockedUntil) {
    const s = Math.ceil((lockedUntil - now) / 1000);
    showLock(`Akses dikunci. Coba lagi dalam ${s} detik.`);
    return false;
  }
  if (now - lastRequest < CONFIG.COOLDOWN_MS) {
    const s = Math.ceil((CONFIG.COOLDOWN_MS - (now - lastRequest)) / 1000);
    showLock(`Mohon tunggu ${s} detik sebelum mencoba lagi.`);
    return false;
  }
  return true;
}
function showLock(msg) { $('lockWarning').style.display='flex'; $('lockMsg').textContent=msg; }
function hideLock()    { $('lockWarning').style.display='none'; }

function mulaiLockdown() {
  if (lockTimer) clearInterval(lockTimer);
  lockTimer = setInterval(() => {
    const s = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (s <= 0) { clearInterval(lockTimer); hideLock(); return; }
    showLock(`Terlalu banyak percobaan gagal. Akses dikunci ${s} detik.`);
  }, 1000);
}

// =====================================================
// LOADING
// =====================================================
function setLoading(on) {
  $('loadingOverlay').style.display = on ? 'flex' : 'none';
  $('loginBtn').classList.toggle('loading', on);
  $('loginBtn').disabled = on;
}

// =====================================================
// ALUR TAMPILAN
// =====================================================

/* Semua layar tersembunyi */
function sembunyikanSemua() {
  $('heroSection').style.display          = 'none';
  $('pengumumanSection').style.display    = 'none';
  $('suratOuter').style.display           = 'none';
  $('infoSection').style.display          = 'none';
}

/* Tampilkan layar pengumuman (lulus / tidak / error) */
function tampilkanPengumuman(siswa, isFound) {
  sembunyikanSemua();
  $('pengumumanSection').style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  $('hasilLulus').style.display = 'none';
  $('hasilTidak').style.display = 'none';
  $('hasilError').style.display = 'none';

  if (!isFound) {
    $('hasilError').style.display = 'block';
    return;
  }

  const statusRaw = (siswa.status || '').toUpperCase().trim();
  const isLulus   = statusRaw.includes('LULUS') && !statusRaw.includes('TIDAK');

  if (isLulus) {
    $('namaLulus').textContent     = toTitleCase(siswa.nama) || '—';
    $('angkatanLulus').textContent = siswa.angkatan || '2026';
    $('pesanLulus').textContent    = siswa.pesan || '';
    $('hasilLulus').style.display  = 'block';
    buatKonfeti();
  } else {
    $('namaTidak').textContent     = toTitleCase(siswa.nama) || '—';
    $('angkatanTidak').textContent = siswa.angkatan || '2026';
    $('pesanTidak').textContent    = siswa.pesan || '';
    $('hasilTidak').style.display  = 'block';
  }
}

/* Tombol "Download Surat" → tampilkan surat + scroll ke surat */
function tampilkanSurat() {
  if (!dataSiswa) return;
  sembunyikanSemua();
  isiDataSurat(dataSiswa);
  $('suratOuter').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Kembali dari surat ke layar pengumuman hasil */
function kembaliKePengumuman() {
  if (!dataSiswa) { kembali(); return; }
  $('suratOuter').style.display        = 'none';
  $('pengumumanSection').style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Kembali ke halaman login */
function kembali() {
  dataSiswa = null;
  sembunyikanSemua();
  $('heroSection').style.display  = 'flex';
  $('infoSection').style.display  = 'block';
  hideLock();
  clearFieldErrors();
  $('inputNISN').value     = '';
  $('inputPassword').value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => $('inputNISN').focus(), 400);
}

// =====================================================
// MAIN LOGIN
// =====================================================
async function doLogin() {
  if (isRequesting) return;
  hideLock();

  const nisn = $('inputNISN').value.trim();
  const pw   = $('inputPassword').value.trim();

  if (!validateNISN() | !validatePW()) return;  // | bukan || agar keduanya di-validasi
  if (!checkSpam()) return;

  isRequesting = true;
  lastRequest  = Date.now();
  setLoading(true);

  try {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set('action', 'login');
    url.searchParams.set('nisn',   nisn);
    url.searchParams.set('nik',    pw);

    const res  = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    setLoading(false);
    isRequesting = false;

    if (data.status === 'found') {
      failCount  = 0;
      dataSiswa  = data.siswa;
      tampilkanPengumuman(data.siswa, true);
    } else {
      failCount++;
      if (failCount >= CONFIG.MAX_FAIL) {
        lockedUntil = Date.now() + CONFIG.LOCKOUT_MS;
        failCount   = 0;
        mulaiLockdown();
      }
      dataSiswa = null;
      tampilkanPengumuman(null, false);
    }

  } catch (err) {
    setLoading(false);
    isRequesting = false;
    console.error(err);
    showLock('Gagal terhubung ke server. Periksa koneksi internet Anda.');
  }
}

// =====================================================
// ISI DATA SURAT
// =====================================================
function isiDataSurat(s) {
  const ttl = `${s.tempat_lahir || '—'}, ${formatTanggal(s.tanggal_lahir)}`;

  $('sNama').textContent        = (s.nama || '—').toUpperCase();
  $('sTTL').textContent         = ttl;
  $('sJK').textContent          = formatJK(s.jk);
  $('sNISN').textContent        = s.nisn          || '—';
  $('sNomorUjian').textContent  = s.nomor_ujian    || '—';
  $('sKelas').textContent       = s.kelas          || '—';
  $('sAngkatan').textContent    = s.angkatan       || '2026';
  $('suratAngkatan').textContent= s.angkatan       || '2026';

  // Status
  const statusRaw = (s.status || '').trim().toUpperCase();
  $('sStatus').textContent      = statusRaw || '—';
  $('statusKotak').className    = 'status-kotak ' + getStatusClass(statusRaw);

  // Pesan
  const pw = $('suratPesanWrap');
  if (s.pesan && s.pesan.trim()) {
    $('sPesan').textContent = s.pesan;
    pw.style.display = 'block';
  } else {
    pw.style.display = 'none';
  }

  // Tanggal
  const hariIni = formatTanggal(new Date().toISOString().slice(0,10));
  $('suratNomor').innerHTML  = CONFIG.NOMOR_SURAT_PREFIX + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + CONFIG.NOMOR_SURAT_SUFFIX;
  $('suratTanggal').textContent = hariIni;
  $('ttdTanggal').textContent   = hariIni;

  // QR Code
  buatQRCode(s);
}

// =====================================================
// HALAMAN VERIFIKASI — dibuka saat QR di-scan
// =====================================================

/**
 * Buat URL verifikasi unik untuk dokumen siswa.
 * Format: BASE_URL/verify.html?nisn=XXX&nama=XXX&status=XXX&tgl=XXX
 * Saat di-scan, browser membuka halaman verify.html
 * yang menampilkan info bahwa dokumen telah ditandatangani.
 */
function buatURLVerifikasi(s) {
  // Gunakan URL website Netlify Anda di sini
  // Contoh: https://pengumuman-smpn30semarang.netlify.app
  const BASE = window.location.origin;

  const params = new URLSearchParams({
    nisn:   s.nisn || '',
    nama:   s.nama || '',
    status: (s.status || '').toUpperCase(),
    kelas:  s.kelas || '',
    tgl:    CONFIG.TTD_DATE,  // tanggal tanda tangan kepala sekolah
    sekolah: 'SMP Negeri 30 Semarang',
  });

  return `${BASE}/verify.html?${params.toString()}`;
}

// =====================================================
// QR CODE — isi URL verifikasi dokumen
// =====================================================
function buatQRCode(s) {
  const box = $('qrCodeBox');
  box.innerHTML = '';

  const urlVerifikasi = buatURLVerifikasi(s);

  try {
    new QRCode(box, {
      text:         urlVerifikasi,
      width:        90,
      height:       90,
      colorDark:    '#000000',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch(e) {
    box.innerHTML = '<p style="font-size:8pt;color:#888;padding:4px;">QR tidak tersedia</p>';
  }
}

// =====================================================
// KONFETI (hanya untuk LULUS)
// =====================================================
function buatKonfeti() {
  const container = $('konfeti');
  if (!container) return;
  container.innerHTML = '';
  const warna = ['#f5c842','#fff','#a3e635','#67e8f9','#f9a8d4','#fdba74'];
  for (let i = 0; i < 28; i++) {
    const dot = document.createElement('div');
    dot.className = 'konfeti-dot';
    dot.style.cssText = [
      `left:${Math.random()*100}%`,
      `top:${Math.random()*-10}%`,
      `background:${warna[Math.floor(Math.random()*warna.length)]}`,
      `width:${6+Math.random()*6}px`,
      `height:${6+Math.random()*6}px`,
      `animation-duration:${2.5+Math.random()*3}s`,
      `animation-delay:${Math.random()*2}s`,
      `border-radius:${Math.random()>.5?'50%':'2px'}`,
    ].join(';');
    container.appendChild(dot);
  }
}

// =====================================================
// CETAK PDF
// =====================================================
function cetakPDF() {
  window.print();
}

// =====================================================
// FORMAT HELPERS
// =====================================================
const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];

function formatTanggal(str) {
  if (!str) return '—';
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${parseInt(m[3])} ${BULAN_ID[parseInt(m[2])-1]} ${m[1]}`;
  return str;
}
function formatJK(kode) {
  if (!kode) return '—';
  const k = kode.toString().trim().toUpperCase();
  return k === 'L' ? 'Laki-Laki' : k === 'P' ? 'Perempuan' : kode;
}
function getStatusClass(s) {
  if (!s) return '';
  if (s.includes('LULUS') && !s.includes('TIDAK')) return 'status-lulus';
  if (s.includes('TIDAK') || s.includes('GAGAL'))  return 'status-tidak';
  return '';
}
function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// =====================================================
// DEMO MODE
// =====================================================
function isDemoMode() {
  return CONFIG.API_URL.includes('GANTI_DENGAN');
}

function showDemoBanner() {
  window.fetch = async (url) => {
    await new Promise(r => setTimeout(r, 1400));
    const p    = new URL(url).searchParams;
    const nisn = p.get('nisn');
    const nik  = p.get('nik');

    const db = {
      '0098765432': {
        nisn:'0098765432', nik:'3374000000000001',
        nama:'Budi Santoso', tempat_lahir:'Semarang',
        tanggal_lahir:'2011-03-22', jk:'L',
        kelas:'IX A', nomor_ujian:'24-001-008',
        angkatan:'2026', status:'LULUS',
        pesan:'Selamat atas kelulusannya! Harap hadir pada acara wisuda yang akan dijadwalkan kemudian.',
      },
      '0011223344': {
        nisn:'0011223344', nik:'3374000000000002',
        nama:'Siti Rahayu', tempat_lahir:'Semarang',
        tanggal_lahir:'2011-07-10', jk:'P',
        kelas:'IX B', nomor_ujian:'24-002-015',
        angkatan:'2026', status:'LULUS',
        pesan:'Selamat atas kelulusannya dengan nilai yang memuaskan.',
      },
      '0055667788': {
        nisn:'0055667788', nik:'3374000000000003',
        nama:'Andi Wijaya', tempat_lahir:'Demak',
        tanggal_lahir:'2011-11-05', jk:'L',
        kelas:'IX C', nomor_ujian:'24-003-022',
        angkatan:'2026', status:'TIDAK LULUS',
        pesan:'Silakan hubungi Wali Kelas untuk informasi selanjutnya.',
      },
    };

    const siswa = db[nisn];
    if (siswa && siswa.nik === nik)
      return { ok:true, json: async()=>({ status:'found', siswa }) };
    return { ok:true, json: async()=>({ status:'not_found' }) };
  };

  const b = document.createElement('div');
  b.style.cssText = 'background:#fef3c7;border-bottom:2px solid #f59e0b;padding:10px 20px;text-align:center;font-size:.78rem;color:#78350f;font-weight:600;font-family:Plus Jakarta Sans,sans-serif;position:relative;z-index:200;';
  b.innerHTML =
    '⚠️ <strong>MODE DEMO</strong> — ' +
    'LULUS → NISN: <code style="background:#fde68a;padding:1px 6px;border-radius:4px">0098765432</code> ' +
    'Pass: <code style="background:#fde68a;padding:1px 6px;border-radius:4px">3374000000000001</code> &nbsp;|&nbsp; ' +
    'TIDAK LULUS → NISN: <code style="background:#fde68a;padding:1px 6px;border-radius:4px">0055667788</code> ' +
    'Pass: <code style="background:#fde68a;padding:1px 6px;border-radius:4px">3374000000000003</code>';
  document.body.insertAdjacentElement('afterbegin', b);
}
