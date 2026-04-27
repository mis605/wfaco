// ============================================================
// APP.JS - Logika utama & UI controller
// ============================================================

import { APP_CONFIG } from './config.js';
import authService from './auth.js';
import graphService from './graph.js';
import {
  CameraService, GeoService,
  formatTanggal, formatJam, formatTanggalPendek,
  hitungDurasi, showToast, setLoading, getMonthYear
} from './utils.js';

// ============================================================
// STATE GLOBAL
// ============================================================
const state = {
  user: null,          // MS user profile
  karyawan: null,      // Data karyawan dari Excel
  absensiHariIni: null,
  absensiHistory: [],
  semuaKaryawan: [],
  rekapData: [],
  camera: new CameraService(),
  fotoCaptured: null,
  locationData: null,
  currentView: 'dashboard',
  isAdmin: false,
};

// ============================================================
// ROUTER VIEWS
// ============================================================
const views = {
  login: document.getElementById('view-login'),
  dashboard: document.getElementById('view-dashboard'),
  riwayat: document.getElementById('view-riwayat'),
  rekap: document.getElementById('view-rekap'),
  karyawan: document.getElementById('view-karyawan'),
  loading: document.getElementById('view-loading'),
};

function showView(viewName) {
  const appShell = document.getElementById('app-shell');
  const isAuthView = viewName === 'login' || viewName === 'loading';
  
  // Toggle app shell visibility
  if (appShell) appShell.classList.toggle('hidden', isAuthView);
  
  // Hide/show individual views
  Object.entries(views).forEach(([name, el]) => {
    if (!el) return;
    if (isAuthView) {
      // For auth views, hide all section views
      el.classList.add('hidden');
    } else {
      // For app views, show only the matching one
      if (['dashboard','riwayat','rekap','karyawan'].includes(name)) {
        el.classList.toggle('hidden', name !== viewName);
      }
    }
  });
  
  // Show login/loading views directly
  if (views.login) views.login.classList.toggle('hidden', viewName !== 'login');
  if (views.loading) views.loading.classList.toggle('hidden', viewName !== 'loading');
  
  state.currentView = viewName;
  
  // Update nav active state
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('nav__item--active', el.dataset.nav === viewName);
  });
  
  // Show/hide FAB on karyawan view
  const fab = document.getElementById('btn-tambah-karyawan');
  if (fab) fab.classList.toggle('hidden', viewName !== 'karyawan');
}

// ============================================================
// INISIALISASI APP
// ============================================================
async function initApp() {
  showView('loading');
  
  try {
    await authService.init();
    
    if (!authService.isLoggedIn()) {
      showView('login');
      return;
    }

    await loadUserSession();
    
  } catch (err) {
    console.error('Init error:', err);
    showView('login');
  }
}

async function loadUserSession() {
  showView('loading');
  document.getElementById('loading-text').textContent = 'Memuat data...';
  
  try {
    // Ambil profil MS
    state.user = await authService.getUserProfile();
    
    // Pastikan sheet dan tabel Excel sudah dibuat (mencegah error 404)
    try {
      document.getElementById('loading-text').textContent = 'Menyiapkan database...';
      await graphService.initializeExcelFile();
    } catch (e) {
      console.warn('Gagal inisialisasi Excel:', e);
    }
    
    document.getElementById('loading-text').textContent = 'Memuat data karyawan...';
    // Cek data karyawan
    state.karyawan = await graphService.getKaryawanByEmail(state.user.mail || state.user.userPrincipalName);
    
    if (!state.karyawan) {
      // Karyawan belum terdaftar
      showView('login');
      document.getElementById('login-error').textContent = 
        'Akun Anda belum terdaftar sebagai karyawan. Hubungi admin.';
      document.getElementById('login-error').classList.remove('hidden');
      await authService.logout();
      return;
    }

    if (state.karyawan.statusAktif !== 'Aktif') {
      showView('login');
      document.getElementById('login-error').textContent = 'Akun Anda tidak aktif.';
      document.getElementById('login-error').classList.remove('hidden');
      await authService.logout();
      return;
    }

    // Load absensi hari ini
    state.absensiHariIni = await graphService.getAbsensiHariIni(state.karyawan.nip);
    
    // Load foto profil
    const photoUrl = await authService.getUserPhoto();
    const initials = getInitials(state.karyawan.nama);
    
    if (photoUrl) {
      document.querySelectorAll('.user-avatar, .greeting-avatar').forEach(el => {
        el.style.backgroundImage = `url(${photoUrl})`;
        el.textContent = '';
      });
    } else {
      document.querySelectorAll('.user-avatar, .greeting-avatar').forEach(el => {
        el.textContent = initials;
      });
    }

    // Render dashboard
    renderDashboard();
    showView('dashboard');
    
  } catch (err) {
    console.error('Session error:', err);
    showToast('Gagal memuat data: ' + err.message, 'error');
    showView('login');
  }
}

function getInitials(nama) {
  return nama.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const k = state.karyawan;
  const a = state.absensiHariIni;
  const now = new Date();
  
  // Info user
  document.getElementById('dash-nama').textContent = k.nama;
  document.getElementById('dash-jabatan').textContent = `${k.jabatan} • ${k.departemen}`;
  document.getElementById('dash-tanggal').textContent = formatTanggal(now.toISOString());
  
  // Status absen hari ini
  const statusEl = document.getElementById('dash-status');
  const masukEl = document.getElementById('dash-masuk');
  const keluarEl = document.getElementById('dash-keluar');
  const durasiEl = document.getElementById('dash-durasi');
  
  if (!a) {
    statusEl.textContent = 'Belum Absen';
    statusEl.className = 'status-badge status--pending';
    masukEl.textContent = '--:--';
    keluarEl.textContent = '--:--';
    durasiEl.textContent = '--';
  } else {
    statusEl.textContent = a.jamKeluar ? 'Selesai' : a.status;
    statusEl.className = `status-badge status--${getStatusClass(a.status)}`;
    masukEl.textContent = formatJam(a.jamMasuk);
    keluarEl.textContent = a.jamKeluar ? formatJam(a.jamKeluar) : '--:--';
    durasiEl.textContent = hitungDurasi(a.jamMasuk, a.jamKeluar);
  }

  // Tombol absen
  const btnMasuk = document.getElementById('btn-absen-masuk');
  const btnKeluar = document.getElementById('btn-absen-keluar');
  
  if (!a) {
    btnMasuk.disabled = false;
    btnMasuk.classList.remove('btn--disabled');
    btnKeluar.disabled = true;
    btnKeluar.classList.add('btn--disabled');
  } else if (!a.jamKeluar) {
    btnMasuk.disabled = true;
    btnMasuk.classList.add('btn--disabled');
    btnKeluar.disabled = false;
    btnKeluar.classList.remove('btn--disabled');
  } else {
    btnMasuk.disabled = true;
    btnMasuk.classList.add('btn--disabled');
    btnKeluar.disabled = true;
    btnKeluar.classList.add('btn--disabled');
  }

  // Info jam absen
  const infoMasuk = document.getElementById('info-jam-masuk');
  const infoKeluar = document.getElementById('info-jam-keluar');
  if (infoMasuk) infoMasuk.textContent = `${APP_CONFIG.jamMasukMulai}–${APP_CONFIG.jamMasukSelesai}`;
  if (infoKeluar) infoKeluar.textContent = `${APP_CONFIG.jamKeluarMulai}–${APP_CONFIG.jamKeluarSelesai}`;
  
  // Nama perusahaan
  const companyEl = document.getElementById('company-name');
  if (companyEl) companyEl.textContent = APP_CONFIG.namaPerusahaan;
  
  // Jam sekarang live
  updateClock();
}

function getStatusClass(status) {
  const map = {
    'Tepat Waktu': 'success',
    'Terlambat Ringan': 'warning',
    'Terlambat': 'danger',
    'Selesai': 'success',
    'Belum Absen': 'pending',
  };
  return map[status] || 'pending';
}

function updateClock() {
  const clockEl = document.getElementById('live-clock');
  if (!clockEl) return;
  
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };
  update();
  
  if (!window._clockInterval) {
    window._clockInterval = setInterval(update, 1000);
  }
}

// ============================================================
// ABSEN FLOW
// ============================================================
let absenMode = 'masuk'; // 'masuk' | 'keluar'

async function openAbsenModal(mode) {
  absenMode = mode;
  state.fotoCaptured = null;
  state.locationData = null;
  
  const modal = document.getElementById('modal-absen');
  const title = document.getElementById('modal-absen-title');
  const preview = document.getElementById('foto-preview');
  const videoEl = document.getElementById('camera-video');
  const btnCapture = document.getElementById('btn-capture');
  const btnRetake = document.getElementById('btn-retake');
  const btnSubmit = document.getElementById('btn-submit-absen');
  const locInfo = document.getElementById('loc-info');
  
  title.textContent = mode === 'masuk' ? 'Absen Masuk' : 'Absen Keluar';
  preview.classList.add('hidden');
  videoEl.classList.remove('hidden');
  btnCapture.classList.remove('hidden');
  btnRetake.classList.add('hidden');
  btnSubmit.disabled = true;
  locInfo.textContent = 'Mendapatkan lokasi...';
  
  modal.classList.remove('hidden');
  modal.classList.add('modal--show');
  
  // Start camera & get location concurrently
  try {
    await state.camera.startCamera(videoEl, 'user');
  } catch (err) {
    showToast(err.message, 'warning');
  }
  
  // Get location
  try {
    state.locationData = await GeoService.getCurrentPosition();
    const address = await GeoService.getAddressFromCoords(
      state.locationData.latitude, state.locationData.longitude
    );
    locInfo.textContent = `📍 ${address}`;
  } catch (err) {
    locInfo.textContent = `⚠ Lokasi tidak tersedia`;
    state.locationData = null;
  }
}

function closeAbsenModal() {
  state.camera.stopCamera();
  const modal = document.getElementById('modal-absen');
  modal.classList.remove('modal--show');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

function capturePhoto() {
  const videoEl = document.getElementById('camera-video');
  const preview = document.getElementById('foto-preview');
  const btnCapture = document.getElementById('btn-capture');
  const btnRetake = document.getElementById('btn-retake');
  const btnSubmit = document.getElementById('btn-submit-absen');
  
  try {
    const canvas = document.getElementById('capture-canvas');
    
    // Siapkan data watermark
    const now = new Date();
    const timestampStr = now.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric'
    }) + ' ' + now.toLocaleTimeString('id-ID');
    const locText = document.getElementById('loc-info').textContent.replace('📍 ', '');
    
    state.fotoCaptured = state.camera.capturePhoto(videoEl, canvas, {
      timestamp: timestampStr,
      location: locText
    });
    
    preview.src = state.fotoCaptured;
    preview.classList.remove('hidden');
    videoEl.classList.add('hidden');
    btnCapture.classList.add('hidden');
    btnRetake.classList.remove('hidden');
    btnSubmit.disabled = false;
    
    state.camera.stopCamera();
  } catch (err) {
    showToast('Gagal mengambil foto: ' + err.message, 'error');
  }
}

function retakePhoto() {
  const videoEl = document.getElementById('camera-video');
  const preview = document.getElementById('foto-preview');
  const btnCapture = document.getElementById('btn-capture');
  const btnRetake = document.getElementById('btn-retake');
  const btnSubmit = document.getElementById('btn-submit-absen');
  
  state.fotoCaptured = null;
  preview.classList.add('hidden');
  videoEl.classList.remove('hidden');
  btnCapture.classList.remove('hidden');
  btnRetake.classList.add('hidden');
  btnSubmit.disabled = true;
  
  state.camera.startCamera(videoEl, 'user').catch(err => {
    showToast(err.message, 'warning');
  });
}

async function submitAbsen() {
  if (APP_CONFIG.fotoWajib && !state.fotoCaptured) {
    showToast('Foto selfie wajib diambil terlebih dahulu.', 'warning');
    return;
  }
  
  const btn = document.getElementById('btn-submit-absen');
  setLoading(btn, true);
  
  try {
    // Kompres foto
    let fotoBase64 = state.fotoCaptured;
    if (fotoBase64) {
      fotoBase64 = await CameraService.compressImage(fotoBase64, 400, 0.6);
    }
    
    const payload = {
      nip: state.karyawan.nip,
      nama: state.karyawan.nama,
      latitude: state.locationData?.latitude || '',
      longitude: state.locationData?.longitude || '',
      keterangan: document.getElementById('absen-keterangan').value,
    };
    
    if (absenMode === 'masuk') {
      payload.fotoMasuk = fotoBase64;
      const result = await graphService.absenMasuk(payload);
      showToast(`✓ Absen masuk berhasil! Status: ${result.status}`, 'success');
    } else {
      payload.fotoKeluar = fotoBase64;
      const result = await graphService.absenKeluar(payload);
      showToast(`✓ Absen keluar berhasil! Jam: ${result.jamKeluar.substring(0,5)}`, 'success');
    }
    
    // Reload data
    state.absensiHariIni = await graphService.getAbsensiHariIni(state.karyawan.nip);
    renderDashboard();
    closeAbsenModal();
    
    // Reset keterangan
    document.getElementById('absen-keterangan').value = '';
    
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(btn, false, 'Absen Sekarang');
  }
}

// ============================================================
// RIWAYAT ABSENSI
// ============================================================
async function loadRiwayat() {
  const { bulan, tahun } = getMonthYear();
  const listEl = document.getElementById('riwayat-list');
  const totalEl = document.getElementById('riwayat-total');
  
  listEl.innerHTML = '<div class="skeleton-list"></div>';
  
  try {
    state.absensiHistory = await graphService.getAbsensiBulanIni(state.karyawan.nip);
    renderRiwayatList(state.absensiHistory);
    totalEl.textContent = `${state.absensiHistory.length} hari`;
  } catch (err) {
    listEl.innerHTML = `<p class="empty-state">Gagal memuat: ${err.message}</p>`;
    showToast('Gagal memuat riwayat', 'error');
  }
}

function renderRiwayatList(data) {
  const listEl = document.getElementById('riwayat-list');
  
  if (data.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Belum ada data absensi bulan ini.</p>';
    return;
  }
  
  const sorted = [...data].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  
  listEl.innerHTML = sorted.map(item => `
    <div class="riwayat-card" onclick="toggleRiwayatDetail(this)">
      <div class="riwayat-card__header">
        <div>
          <div class="riwayat-card__tanggal">${formatTanggalPendek(item.tanggal)}</div>
          <span class="status-badge status--${getStatusClass(item.status)}">${item.status}</span>
        </div>
        <div class="riwayat-card__times">
          <div class="time-entry">
            <span class="time-label">Masuk</span>
            <span class="time-val">${formatJam(item.jamMasuk)}</span>
          </div>
          <div class="time-divider">→</div>
          <div class="time-entry">
            <span class="time-label">Keluar</span>
            <span class="time-val">${item.jamKeluar ? formatJam(item.jamKeluar) : '--:--'}</span>
          </div>
          <div class="time-entry">
            <span class="time-label">Durasi</span>
            <span class="time-val">${hitungDurasi(item.jamMasuk, item.jamKeluar)}</span>
          </div>
        </div>
      </div>
      ${item.keterangan ? `<div class="riwayat-card__ket">${item.keterangan}</div>` : ''}
      <div class="riwayat-card__detail hidden">
        ${item.fotoMasuk ? `<img src="${item.fotoMasuk}" class="thumb-foto" alt="Foto Masuk">` : ''}
        ${item.fotoKeluar ? `<img src="${item.fotoKeluar}" class="thumb-foto" alt="Foto Keluar">` : ''}
        ${item.latMasuk ? `<p class="loc-text">📍 ${Number(item.latMasuk).toFixed(5)}, ${Number(item.lngMasuk).toFixed(5)}</p>` : ''}
      </div>
    </div>
  `).join('');
}

function toggleRiwayatDetail(card) {
  const detail = card.querySelector('.riwayat-card__detail');
  if (detail) detail.classList.toggle('hidden');
}

// ============================================================
// REKAP (ADMIN)
// ============================================================
async function loadRekap() {
  const { bulan, tahun } = getMonthYear();
  document.getElementById('rekap-periode').textContent = 
    new Date(tahun, bulan-1).toLocaleDateString('id-ID', {month:'long', year:'numeric'});
  
  const tableBody = document.getElementById('rekap-tbody');
  tableBody.innerHTML = '<tr><td colspan="6" class="loading-cell">Memuat...</td></tr>';
  
  try {
    state.rekapData = await graphService.getRekapAbsensi(bulan, tahun);
    renderRekapTable(state.rekapData);
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
  }
}

function renderRekapTable(data) {
  const tableBody = document.getElementById('rekap-tbody');
  
  if (data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Tidak ada data.</td></tr>';
    return;
  }
  
  tableBody.innerHTML = data.map(item => `
    <tr>
      <td>${item.nip}</td>
      <td>${item.nama}</td>
      <td>${formatTanggalPendek(item.tanggal)}</td>
      <td>${formatJam(item.jamMasuk)}</td>
      <td>${item.jamKeluar ? formatJam(item.jamKeluar) : '-'}</td>
      <td><span class="status-badge status--${getStatusClass(item.status)}">${item.status}</span></td>
    </tr>
  `).join('');
}

// Filter rekap
function filterRekap() {
  const search = document.getElementById('rekap-search').value.toLowerCase();
  const filtered = state.rekapData.filter(item => 
    item.nama.toLowerCase().includes(search) || 
    item.nip.toLowerCase().includes(search)
  );
  renderRekapTable(filtered);
}

// Export to CSV
function exportCSV() {
  const { bulan, tahun } = getMonthYear();
  const rows = [
    ['NIP', 'Nama', 'Tanggal', 'Jam Masuk', 'Jam Keluar', 'Durasi', 'Status'],
    ...state.rekapData.map(item => [
      item.nip, item.nama, item.tanggal,
      formatJam(item.jamMasuk), item.jamKeluar ? formatJam(item.jamKeluar) : '-',
      hitungDurasi(item.jamMasuk, item.jamKeluar), item.status
    ])
  ];
  
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Rekap_Absensi_${bulan}_${tahun}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// MANAJEMEN KARYAWAN (ADMIN)
// ============================================================
async function loadKaryawan() {
  const listEl = document.getElementById('karyawan-list');
  listEl.innerHTML = '<div class="skeleton-list"></div>';
  
  try {
    state.semuaKaryawan = await graphService.getAllKaryawan();
    renderKaryawanList(state.semuaKaryawan);
  } catch (err) {
    listEl.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

function renderKaryawanList(data) {
  const listEl = document.getElementById('karyawan-list');
  
  if (data.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Belum ada data karyawan.</p>';
    return;
  }
  
  listEl.innerHTML = data.map(k => `
    <div class="karyawan-card">
      <div class="karyawan-avatar">${getInitials(k.nama)}</div>
      <div class="karyawan-info">
        <div class="karyawan-nama">${k.nama}</div>
        <div class="karyawan-sub">${k.jabatan} • ${k.departemen}</div>
        <div class="karyawan-nip">NIP: ${k.nip}</div>
      </div>
      <span class="status-badge status--${k.statusAktif === 'Aktif' ? 'success' : 'danger'}">${k.statusAktif}</span>
    </div>
  `).join('');
}

async function submitTambahKaryawan() {
  const btn = document.getElementById('btn-simpan-karyawan');
  const data = {
    nip: document.getElementById('k-nip').value.trim(),
    nama: document.getElementById('k-nama').value.trim(),
    email: document.getElementById('k-email').value.trim(),
    departemen: document.getElementById('k-departemen').value.trim(),
    jabatan: document.getElementById('k-jabatan').value.trim(),
  };
  
  if (!data.nip || !data.nama || !data.email) {
    showToast('NIP, Nama, dan Email wajib diisi.', 'warning');
    return;
  }
  
  setLoading(btn, true);
  
  try {
    await graphService.tambahKaryawan(data);
    showToast('Karyawan berhasil ditambahkan!', 'success');
    document.getElementById('form-karyawan').reset();
    document.getElementById('modal-karyawan').classList.add('hidden');
    await loadKaryawan();
  } catch (err) {
    showToast('Gagal menambah karyawan: ' + err.message, 'error');
  } finally {
    setLoading(btn, false, 'Simpan');
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function bindEvents() {
  // Login
  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-login');
    setLoading(btn, true);
    try {
      await authService.login();
      await loadUserSession();
    } catch (err) {
      showToast('Login gagal: ' + err.message, 'error');
      setLoading(btn, false, 'Masuk dengan Microsoft 365');
    }
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await authService.logout();
    window.location.reload();
  });

  // Navigasi
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const view = el.dataset.nav;
      showView(view);
      
      if (view === 'riwayat') loadRiwayat();
      if (view === 'rekap') loadRekap();
      if (view === 'karyawan') loadKaryawan();
    });
  });

  // Absen masuk/keluar
  document.getElementById('btn-absen-masuk')?.addEventListener('click', () => openAbsenModal('masuk'));
  document.getElementById('btn-absen-keluar')?.addEventListener('click', () => openAbsenModal('keluar'));
  
  // Camera controls
  document.getElementById('btn-capture')?.addEventListener('click', capturePhoto);
  document.getElementById('btn-retake')?.addEventListener('click', retakePhoto);
  document.getElementById('btn-submit-absen')?.addEventListener('click', submitAbsen);
  document.getElementById('btn-close-modal')?.addEventListener('click', closeAbsenModal);
  
  // Rekap filter
  document.getElementById('rekap-search')?.addEventListener('input', filterRekap);
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);
  
  // Karyawan
  document.getElementById('btn-tambah-karyawan')?.addEventListener('click', () => {
    document.getElementById('modal-karyawan').classList.remove('hidden');
  });
  document.getElementById('btn-close-karyawan')?.addEventListener('click', () => {
    document.getElementById('modal-karyawan').classList.add('hidden');
  });
  document.getElementById('btn-simpan-karyawan')?.addEventListener('click', submitTambahKaryawan);
  
  // Close modal on backdrop click
  document.getElementById('modal-absen')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAbsenModal();
  });
}

// ============================================================
// ENTRY POINT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  initApp();
});

// Expose untuk inline handlers
window.toggleRiwayatDetail = toggleRiwayatDetail;
