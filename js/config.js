// ============================================================
// CONFIG.JS - Konfigurasi utama aplikasi
// Ganti nilai di bawah sesuai tenant M365 Anda
// ============================================================

const APP_CONFIG = {
  // --- AZURE AD APP REGISTRATION ---
  // Daftar di: https://portal.azure.com > App registrations
  clientId: "efa1afcc-0850-4433-a107-bec0fd0ee282",
  tenantId: "5194178e-ce02-4b0c-8442-1374fd7eca0d",
  
  // Redirect URI harus sama persis dengan yang didaftarkan di Azure AD
  // Contoh: https://namadomain.github.io/absen-wfa/ atau http://localhost:3000
  redirectUri: window.location.origin + window.location.pathname,

  // --- EXCEL FILE CONFIG ---
  // Cara mendapatkan driveId & fileId:
  // 1. Buka file Excel di OneDrive/SharePoint
  // 2. Klik Share > Copy link
  // 3. Atau gunakan Graph Explorer: https://developer.microsoft.com/en-us/graph/graph-explorer
  //    GET https://graph.microsoft.com/v1.0/me/drive/root/children
  
  // Jika file di OneDrive personal (gunakan "me"):
  driveType: "me", // "me" untuk OneDrive personal, "site" untuk SharePoint
  
  // ID file Excel (.xlsx) di OneDrive
  // GET /v1.0/me/drive/root/children untuk list file
  excelFileId: "01MWV7VZECUI3NL44YBJA262HMINENFME4",
  
  // Jika menggunakan SharePoint (ubah driveType ke "site"):
  // siteId: "GANTI_DENGAN_SITE_ID",
  // driveId: "GANTI_DENGAN_DRIVE_ID",

  // --- NAMA SHEET/TABLE DI EXCEL ---
  // Sheet "Absensi" harus punya kolom:
  // ID | NIP | Nama | Tanggal | Jam_Masuk | Jam_Keluar | Status | Foto_Masuk | Foto_Keluar | Latitude_Masuk | Longitude_Masuk | Latitude_Keluar | Longitude_Keluar | Keterangan | Dibuat_Pada
  sheetAbsensi: "Absensi",
  tableAbsensi: "TabelAbsensi",

  // Sheet "Karyawan" harus punya kolom:
  // ID | NIP | Nama | Email | Departemen | Jabatan | Status_Aktif | Foto_Profil | Dibuat_Pada
  sheetKaryawan: "Karyawan",
  tableKaryawan: "TabelKaryawan",

  // --- PENGATURAN ABSENSI ---
  jamMasukMulai: "07:00",   // Jam mulai bisa absen masuk
  jamMasukSelesai: "10:00", // Jam batas absen masuk (lewat = terlambat)
  jamKeluarMulai: "16:00",  // Jam mulai bisa absen keluar
  jamKeluarSelesai: "20:00",// Jam batas absen keluar
  
  // Toleransi terlambat dalam menit
  toleransiTerlambat: 15,
  
  // Radius maksimal untuk absen (dalam meter) — opsional untuk WFA
  // Set ke 0 untuk disable validasi lokasi
  radiusMaksimal: 0,
  
  // Apakah foto wajib saat absen
  fotoWajib: true,
  
  // Nama perusahaan
  namaPerusahaan: "PT. GOS INDORAYA",
  logoPerusahaan: "", // URL logo (opsional)
};

// Microsoft Graph API scopes yang dibutuhkan
const GRAPH_SCOPES = [
  "User.Read",
  "Files.ReadWrite",
  "Sites.ReadWrite.All"
];

// MSAL Configuration
const MSAL_CONFIG = {
  auth: {
    clientId: APP_CONFIG.clientId,
    authority: `https://login.microsoftonline.com/${APP_CONFIG.tenantId}`,
    redirectUri: APP_CONFIG.redirectUri,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === msal.LogLevel.Error) console.error(message);
      },
    },
  },
};

export { APP_CONFIG, MSAL_CONFIG, GRAPH_SCOPES };
