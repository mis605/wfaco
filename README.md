# WFA CO (Work From Anywhere Reporting - PWA Edition)

Aplikasi pelaporan harian Work From Anywhere (WFA) versi modern yang dikembangkan sebagai **Progressive Web App (PWA)**. Aplikasi ini dirancang untuk tim Central Operations (CO) agar dapat melakukan presensi (Clock-in/Clock-out) dengan verifikasi foto selfie dan lokasi GPS yang terintegrasi secara aman dengan akun **Microsoft 365** organisasi Anda.

## ✨ Fitur Utama

- **Single Sign-On (SSO)**: Login aman menggunakan akun Microsoft 365 (Azure AD / Entra ID) perusahaan.
- **Clock-in & Clock-out**: Perekaman waktu kerja harian dengan mudah.
- **Verifikasi Lokasi & Foto**: Menarik lokasi GPS secara *real-time* dan mengambil foto selfie *on-the-spot* menggunakan kamera depan perangkat.
- **Database Excel Online**: Data presensi dan karyawan tersimpan secara otomatis, aman, dan tanpa biaya tambahan di Excel Online (SharePoint/OneDrive perusahaan) menggunakan **Microsoft Graph API**.
- **Progressive Web App (PWA)**: Aplikasi dapat diinstal langsung di layar utama (Home Screen) HP (Android/iOS) dan dapat dijalankan layaknya aplikasi *native*.
- **Admin View**: Terdapat dasbor *rekap* untuk memantau data absensi seluruh tim dan mengekspor data ke format CSV.

## 🛠️ Teknologi yang Digunakan

- **Frontend**: HTML5, Vanilla JavaScript (ES6 Modules), CSS kustom, PWA Service Worker.
- **Autentikasi**: MSAL.js (Microsoft Authentication Library) untuk SPA.
- **Integrasi Data**: Microsoft Graph API.
- **Database**: Microsoft Excel Online / OneDrive / SharePoint.

## 📂 Struktur Direktori

- `index.html`: Antarmuka utama aplikasi (Single Page Application).
- `css/style.css`: File styling utama.
- `js/`: Berisi logika utama aplikasi.
  - `app.js`: Logika aplikasi, UI flow, manipulasi DOM.
  - `auth.js`: Penanganan otentikasi MSAL & Token.
  - `graph.js`: Komunikasi dengan Microsoft Graph API (untuk user profil dan manipulasi file Excel).
  - `utils.js`: Utility untuk kamera, GPS, toast UI, dan format tanggal.
  - `config.js`: File konfigurasi (ClientID, FileID, Jam Kerja).
  - `msal-browser.min.js`: Library lokal MSAL.js untuk bypass masalah CORS/AdBlocker.
- `sw.js` & `manifest.json`: File konfigurasi PWA.
- `icons/`: Folder berisi ikon-ikon aplikasi.

## 🚀 Panduan Setup & Deployment

Untuk dapat menjalankan aplikasi ini secara mandiri, diperlukan pengaturan awal di **Azure Portal (Microsoft Entra ID)**.

### 1. Registrasi Aplikasi di Azure Portal
1. Buka [Microsoft Entra ID (Azure AD)](https://portal.azure.com/).
2. Masuk ke **App registrations** > **New registration**.
3. Beri nama aplikasi (misal: `WFA App`).
4. Pada **Supported account types**, pilih *Accounts in this organizational directory only* (atau sesuaikan dengan kebutuhan perusahaan).
5. Pada **Redirect URI**, pilih tipe **Single-page application (SPA)** dan masukkan URL tempat aplikasi ini akan dihosting (contoh: `https://username.github.io/wfa-app/`). Tambahkan juga `http://localhost:5500/` jika ingin menjalankan di server lokal.
6. Klik **Register**.
7. Salin **Application (client) ID** dari halaman *Overview*.

### 2. Pengaturan API Permissions
1. Buka menu **API permissions** pada aplikasi yang baru dibuat.
2. Klik **Add a permission** > **Microsoft Graph** > **Delegated permissions**.
3. Tambahkan izin berikut:
   - `User.Read`
   - `Files.ReadWrite` (atau `Files.ReadWrite.All`)
4. Klik **Grant admin consent** untuk organisasi Anda agar user tidak perlu memberikan izin secara manual satu per satu.

### 3. Persiapan Database (Excel Online)
1. Buat file Excel kosong baru di OneDrive atau SharePoint perusahaan Anda (misal: `WFA_CO.xlsx`).
2. Buat dua sheet baru bernama **Absensi** dan **Karyawan**.
3. Pastikan sheet dikonversi menjadi *Format as Table* dengan nama masing-masing tabel `TabelAbsensi` dan `TabelKaryawan`. (Aplikasi juga bisa mencoba menginisialisasi secara otomatis saat admin login pertama kali jika API berjalan sukses).
4. Dapatkan **Item ID** dari file Excel tersebut (dapat dicari menggunakan *Graph Explorer*).
5. **Penting**: Tambahkan email Anda sendiri ke baris pertama tabel **Karyawan** agar sistem mengenali Anda sebagai pengguna yang sah saat uji coba pertama.

### 4. Konfigurasi Aplikasi (`js/config.js`)
Ubah nilai di file `js/config.js` dengan data yang Anda dapatkan di langkah-langkah sebelumnya:
```javascript
export const MSAL_CONFIG = {
  auth: {
    clientId: 'MASUKKAN_CLIENT_ID_ANDA_DI_SINI',
    authority: 'https://login.microsoftonline.com/MASUKKAN_TENANT_ID_ANDA',
    redirectUri: window.location.origin
  }
};

export const APP_CONFIG = {
  excelFileId: 'MASUKKAN_ITEM_ID_EXCEL_DI_SINI',
  // ...
};
```

### 5. Menjalankan secara Lokal
1. Buka terminal di dalam folder repositori.
2. Jalankan lokal server (misal menggunakan Python: `python3 -m http.server 5500` atau Live Server di VS Code).
3. Buka `http://localhost:5500` di browser.

### 6. Deployment (Hosting)
Anda bisa menghosting folder ini di static web hosting mana pun secara gratis, seperti:
- **GitHub Pages**
- **Cloudflare Pages**
- **Vercel** atau **Netlify**

Setelah dideploy ke layanan tersebut, ubah/tambahkan URL publiknya ke dalam **Redirect URI** di Azure Portal.

---

**Catatan**: Aplikasi ini dirancang agar efisien dengan *backend-less* architecture (sepenuhnya mengandalkan ekosistem Microsoft 365 yang sudah dimiliki perusahaan).
