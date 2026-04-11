// ============================================================
// UTILS.JS - Utility: Kamera, Geolokasi, Helper
// ============================================================

class CameraService {
  constructor() {
    this.stream = null;
    this.videoEl = null;
  }

  async startCamera(videoElement, facingMode = 'user') {
    this.videoEl = videoElement;
    
    if (this.stream) this.stopCamera();
    
    const constraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = this.stream;
      await videoElement.play();
      return true;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Akses kamera ditolak. Izinkan akses kamera di browser Anda.');
      } else if (err.name === 'NotFoundError') {
        throw new Error('Kamera tidak ditemukan di perangkat ini.');
      }
      throw err;
    }
  }

  capturePhoto(videoElement, canvasElement) {
    const video = videoElement || this.videoEl;
    if (!video) throw new Error('Video element tidak tersedia');

    const canvas = canvasElement || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    
    // Mirror untuk selfie (front camera)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Kembalikan transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Kompres ke JPEG base64 (kualitas 0.7 untuk ukuran file lebih kecil)
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }

  // Kompres base64 image
  static async compressImage(base64String, maxWidth = 400, quality = 0.6) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = base64String;
    });
  }
}

class GeoService {
  static async getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolokasi tidak didukung browser ini.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
        (err) => {
          if (err.code === 1) reject(new Error('Akses lokasi ditolak.'));
          else if (err.code === 2) reject(new Error('Lokasi tidak tersedia.'));
          else reject(new Error('Gagal mendapatkan lokasi.'));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
          ...options
        }
      );
    });
  }

  static async getAddressFromCoords(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AbsenWFA/1.0' }
      });
      const data = await res.json();
      return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatTanggal(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatJam(timeStr) {
  if (!timeStr) return '-';
  return String(timeStr).substring(0, 5);
}

function formatTanggalPendek(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function hitungDurasi(jamMasuk, jamKeluar) {
  if (!jamMasuk || !jamKeluar) return '-';
  const [hm, mm] = jamMasuk.split(':').map(Number);
  const [hk, mk] = jamKeluar.split(':').map(Number);
  const diffMenit = (hk * 60 + mk) - (hm * 60 + mm);
  if (diffMenit < 0) return '-';
  const jam = Math.floor(diffMenit / 60);
  const menit = diffMenit % 60;
  return `${jam}j ${menit}m`;
}

function generateUID() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__msg">${message}</span>
  `;

  container.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast--show'));
  
  setTimeout(() => {
    toast.classList.remove('toast--show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

function setLoading(element, loading, originalText = '') {
  if (!element) return;
  if (loading) {
    element.disabled = true;
    element.dataset.originalText = element.textContent;
    element.innerHTML = '<span class="spinner"></span>';
  } else {
    element.disabled = false;
    element.textContent = originalText || element.dataset.originalText || 'Submit';
  }
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getMonthYear() {
  const now = new Date();
  return {
    bulan: now.getMonth() + 1,
    tahun: now.getFullYear(),
    label: now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  };
}

export {
  CameraService, GeoService,
  formatTanggal, formatJam, formatTanggalPendek,
  hitungDurasi, generateUID, debounce,
  showToast, setLoading, getTodayString, getMonthYear
};
