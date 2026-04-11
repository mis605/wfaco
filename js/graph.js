// ============================================================
// GRAPH.JS - Service untuk Microsoft Graph API & Excel Online
// ============================================================

import { APP_CONFIG } from './config.js';
import authService from './auth.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

class GraphService {
  
  // Helper: build URL dasar untuk operasi Excel
  getExcelBaseUrl() {
    if (APP_CONFIG.driveType === 'me') {
      return `${GRAPH_BASE}/me/drive/items/${APP_CONFIG.excelFileId}/workbook`;
    } else {
      return `${GRAPH_BASE}/sites/${APP_CONFIG.siteId}/drives/${APP_CONFIG.driveId}/items/${APP_CONFIG.excelFileId}/workbook`;
    }
  }

  // Helper: fetch dengan auth token
  async apiFetch(url, options = {}) {
    const token = await authService.getAccessToken();
    
    const defaultHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMsg = errorJson.error?.message || errorMsg;
      } catch {}
      throw new Error(`Graph API Error: ${errorMsg}`);
    }

    // 204 No Content
    if (response.status === 204) return null;
    
    return response.json();
  }

  // ============================================================
  // EXCEL TABLE OPERATIONS
  // ============================================================

  // Baca semua baris dari tabel Excel
  async getTableRows(tableName) {
    const url = `${this.getExcelBaseUrl()}/tables/${tableName}/rows`;
    const data = await this.apiFetch(url);
    return data?.value || [];
  }

  // Tambah baris baru ke tabel
  async addTableRow(tableName, values) {
    const url = `${this.getExcelBaseUrl()}/tables/${tableName}/rows/add`;
    return this.apiFetch(url, {
      method: 'POST',
      body: JSON.stringify({ values: [values] }),
    });
  }

  // Update baris berdasarkan index
  async updateTableRow(tableName, rowIndex, values) {
    const url = `${this.getExcelBaseUrl()}/tables/${tableName}/rows/itemAt(index=${rowIndex})`;
    return this.apiFetch(url, {
      method: 'PATCH',
      body: JSON.stringify({ values: [values] }),
    });
  }

  // Cari index baris berdasarkan nilai di kolom tertentu
  async findRowIndex(tableName, columnIndex, searchValue) {
    const rows = await this.getTableRows(tableName);
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i].values[0][columnIndex]) === String(searchValue)) {
        return i;
      }
    }
    return -1;
  }

  // Baca header tabel
  async getTableHeaders(tableName) {
    const url = `${this.getExcelBaseUrl()}/tables/${tableName}/columns`;
    const data = await this.apiFetch(url);
    return data?.value?.map(col => col.name) || [];
  }

  // ============================================================
  // INISIALISASI EXCEL FILE
  // ============================================================
  
  // Buat sheet dan tabel jika belum ada
  async initializeExcelFile() {
    const baseUrl = this.getExcelBaseUrl();
    
    // Cek/buat sheet Absensi
    await this.ensureSheetExists(APP_CONFIG.sheetAbsensi);
    await this.ensureSheetExists(APP_CONFIG.sheetKaryawan);
    
    // Cek/buat tabel
    await this.ensureTableExists(
      APP_CONFIG.sheetAbsensi,
      APP_CONFIG.tableAbsensi,
      'A1',
      ['ID','NIP','Nama','Tanggal','Jam_Masuk','Jam_Keluar','Status',
       'Foto_Masuk_B64','Foto_Keluar_B64','Latitude_Masuk','Longitude_Masuk',
       'Latitude_Keluar','Longitude_Keluar','Keterangan','Dibuat_Pada']
    );
    
    await this.ensureTableExists(
      APP_CONFIG.sheetKaryawan,
      APP_CONFIG.tableKaryawan,
      'A1',
      ['ID','NIP','Nama','Email','Departemen','Jabatan','Status_Aktif',
       'Foto_Profil','Dibuat_Pada']
    );
  }

  async ensureSheetExists(sheetName) {
    const baseUrl = this.getExcelBaseUrl();
    try {
      await this.apiFetch(`${baseUrl}/sheets/${sheetName}`);
    } catch {
      // Sheet tidak ada, buat baru
      await this.apiFetch(`${baseUrl}/sheets/add`, {
        method: 'POST',
        body: JSON.stringify({ name: sheetName }),
      });
    }
  }

  async ensureTableExists(sheetName, tableName, startCell, headers) {
    const baseUrl = this.getExcelBaseUrl();
    try {
      await this.apiFetch(`${baseUrl}/tables/${tableName}`);
    } catch {
      // Tulis header dulu
      const endCell = String.fromCharCode(64 + headers.length) + '1';
      const range = `${sheetName}!${startCell}:${endCell}`;
      
      // Set header values
      await this.apiFetch(`${baseUrl}/worksheets/${sheetName}/range(address='${range}')`, {
        method: 'PATCH',
        body: JSON.stringify({ values: [headers] }),
      });
      
      // Buat tabel dari range
      await this.apiFetch(`${baseUrl}/tables/add`, {
        method: 'POST',
        body: JSON.stringify({
          address: `${sheetName}!${startCell}:${endCell}`,
          hasHeaders: true,
        }),
      });
      
      // Rename tabel
      const tables = await this.apiFetch(`${baseUrl}/tables`);
      if (tables?.value?.length > 0) {
        const lastTable = tables.value[tables.value.length - 1];
        await this.apiFetch(`${baseUrl}/tables/${lastTable.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: tableName }),
        });
      }
    }
  }

  // ============================================================
  // OPERASI KARYAWAN
  // ============================================================

  async getAllKaryawan() {
    const rows = await this.getTableRows(APP_CONFIG.tableKaryawan);
    return rows.map(row => ({
      id: row.values[0][0],
      nip: row.values[0][1],
      nama: row.values[0][2],
      email: row.values[0][3],
      departemen: row.values[0][4],
      jabatan: row.values[0][5],
      statusAktif: row.values[0][6],
      fotoProfil: row.values[0][7],
      dibuatPada: row.values[0][8],
    }));
  }

  async getKaryawanByEmail(email) {
    const rows = await this.getTableRows(APP_CONFIG.tableKaryawan);
    const found = rows.find(row => 
      String(row.values[0][3]).toLowerCase() === email.toLowerCase()
    );
    if (!found) return null;
    return {
      id: found.values[0][0],
      nip: found.values[0][1],
      nama: found.values[0][2],
      email: found.values[0][3],
      departemen: found.values[0][4],
      jabatan: found.values[0][5],
      statusAktif: found.values[0][6],
      fotoProfil: found.values[0][7],
    };
  }

  async tambahKaryawan(data) {
    const id = `KRY-${Date.now()}`;
    const values = [
      id, data.nip, data.nama, data.email,
      data.departemen, data.jabatan, 'Aktif',
      data.fotoProfil || '', new Date().toISOString()
    ];
    await this.addTableRow(APP_CONFIG.tableKaryawan, values);
    return id;
  }

  async updateKaryawan(id, data) {
    const rows = await this.getTableRows(APP_CONFIG.tableKaryawan);
    const idx = rows.findIndex(r => String(r.values[0][0]) === String(id));
    if (idx === -1) throw new Error('Karyawan tidak ditemukan');
    
    const existing = rows[idx].values[0];
    const updated = [
      existing[0],
      data.nip ?? existing[1],
      data.nama ?? existing[2],
      data.email ?? existing[3],
      data.departemen ?? existing[4],
      data.jabatan ?? existing[5],
      data.statusAktif ?? existing[6],
      data.fotoProfil ?? existing[7],
      existing[8]
    ];
    await this.updateTableRow(APP_CONFIG.tableKaryawan, idx, updated);
  }

  // ============================================================
  // OPERASI ABSENSI
  // ============================================================

  async getAbsensiHariIni(nip) {
    const today = new Date().toLocaleDateString('id-ID', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).split('/').reverse().join('-');
    
    const rows = await this.getTableRows(APP_CONFIG.tableAbsensi);
    const found = rows.find(row => {
      const rowNip = String(row.values[0][1]);
      const rowTgl = String(row.values[0][3]).substring(0, 10);
      return rowNip === String(nip) && rowTgl === today;
    });
    
    if (!found) return null;
    return this.rowToAbsensi(found, rows.indexOf(found));
  }

  async getAbsensiBulanIni(nip) {
    const now = new Date();
    const bulanIni = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    
    const rows = await this.getTableRows(APP_CONFIG.tableAbsensi);
    return rows
      .filter(row => {
        const rowNip = String(row.values[0][1]);
        const rowTgl = String(row.values[0][3]).substring(0, 7);
        return rowNip === String(nip) && rowTgl === bulanIni;
      })
      .map((row, i) => this.rowToAbsensi(row, i));
  }

  async getRekapAbsensi(bulan, tahun) {
    const prefix = `${tahun}-${String(bulan).padStart(2,'0')}`;
    const rows = await this.getTableRows(APP_CONFIG.tableAbsensi);
    return rows
      .filter(row => String(row.values[0][3]).startsWith(prefix))
      .map((row, i) => this.rowToAbsensi(row, i));
  }

  async absenMasuk(data) {
    // Cek apakah sudah absen hari ini
    const existing = await this.getAbsensiHariIni(data.nip);
    if (existing) throw new Error('Anda sudah melakukan absen masuk hari ini.');
    
    const id = `ABS-${Date.now()}`;
    const now = new Date();
    const tanggal = now.toISOString().split('T')[0];
    const jamMasuk = now.toTimeString().substring(0, 8);
    
    // Tentukan status ketepatan waktu
    const status = this.hitungStatus(jamMasuk);
    
    const values = [
      id,
      data.nip,
      data.nama,
      tanggal,
      jamMasuk,
      '',          // Jam keluar (belum)
      status,
      data.fotoMasuk || '',
      '',          // Foto keluar
      data.latitude || '',
      data.longitude || '',
      '',          // Lat keluar
      '',          // Lng keluar
      data.keterangan || '',
      now.toISOString()
    ];
    
    await this.addTableRow(APP_CONFIG.tableAbsensi, values);
    return { id, status, jamMasuk };
  }

  async absenKeluar(data) {
    const existing = await this.getAbsensiHariIni(data.nip);
    if (!existing) throw new Error('Anda belum melakukan absen masuk hari ini.');
    if (existing.jamKeluar) throw new Error('Anda sudah melakukan absen keluar hari ini.');
    
    const now = new Date();
    const jamKeluar = now.toTimeString().substring(0, 8);
    
    const rows = await this.getTableRows(APP_CONFIG.tableAbsensi);
    const idx = rows.findIndex(r => String(r.values[0][0]) === String(existing.id));
    if (idx === -1) throw new Error('Data absen tidak ditemukan.');
    
    const current = rows[idx].values[0];
    const updated = [
      current[0], current[1], current[2], current[3],
      current[4],
      jamKeluar,
      current[6],
      current[7],
      data.fotoKeluar || '',
      current[9], current[10],
      data.latitude || '',
      data.longitude || '',
      data.keterangan || current[13],
      current[14]
    ];
    
    await this.updateTableRow(APP_CONFIG.tableAbsensi, idx, updated);
    return { jamKeluar };
  }

  hitungStatus(jamMasuk) {
    const [h, m] = jamMasuk.split(':').map(Number);
    const menitMasuk = h * 60 + m;
    const [bh, bm] = APP_CONFIG.jamMasukSelesai.split(':').map(Number);
    const batasMenit = bh * 60 + bm;
    const toleransi = APP_CONFIG.toleransiTerlambat;
    
    if (menitMasuk <= batasMenit) return 'Tepat Waktu';
    if (menitMasuk <= batasMenit + toleransi) return 'Terlambat Ringan';
    return 'Terlambat';
  }

  rowToAbsensi(row, index) {
    const v = row.values[0];
    return {
      rowIndex: index,
      id: v[0], nip: v[1], nama: v[2], tanggal: v[3],
      jamMasuk: v[4], jamKeluar: v[5], status: v[6],
      fotoMasuk: v[7], fotoKeluar: v[8],
      latMasuk: v[9], lngMasuk: v[10],
      latKeluar: v[11], lngKeluar: v[12],
      keterangan: v[13], dibuatPada: v[14]
    };
  }
}

const graphService = new GraphService();
export default graphService;
