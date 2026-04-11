// ============================================================
// AUTH.JS - Modul autentikasi Microsoft Identity (MSAL.js)
// ============================================================

import { MSAL_CONFIG, GRAPH_SCOPES, APP_CONFIG } from './config.js';

class AuthService {
  constructor() {
    this.msalInstance = null;
    this.currentAccount = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    // Pastikan MSAL sudah di-load
    if (typeof msal === 'undefined') {
      throw new Error('MSAL.js belum dimuat. Periksa koneksi internet Anda.');
    }

    this.msalInstance = new msal.PublicClientApplication(MSAL_CONFIG);
    
    // Handle redirect response
    try {
      const response = await this.msalInstance.handleRedirectPromise();
      if (response) {
        this.currentAccount = response.account;
        this.msalInstance.setActiveAccount(response.account);
      }
    } catch (error) {
      console.error('Error handling redirect:', error);
    }

    // Cek akun yang sudah login
    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      this.currentAccount = accounts[0];
      this.msalInstance.setActiveAccount(accounts[0]);
    }

    this.initialized = true;
  }

  async login() {
    await this.init();
    
    const loginRequest = {
      scopes: GRAPH_SCOPES,
      prompt: "select_account",
    };

    try {
      // Coba popup dulu, fallback ke redirect
      const response = await this.msalInstance.loginPopup(loginRequest);
      this.currentAccount = response.account;
      this.msalInstance.setActiveAccount(response.account);
      return response.account;
    } catch (popupError) {
      if (popupError.errorCode === "popup_window_error" || 
          popupError.errorCode === "empty_window_error") {
        // Fallback ke redirect
        await this.msalInstance.loginRedirect(loginRequest);
      } else {
        throw popupError;
      }
    }
  }

  async logout() {
    await this.init();
    
    const logoutRequest = {
      account: this.msalInstance.getActiveAccount(),
      postLogoutRedirectUri: APP_CONFIG.redirectUri,
    };

    try {
      await this.msalInstance.logoutPopup(logoutRequest);
    } catch {
      await this.msalInstance.logoutRedirect(logoutRequest);
    }
    
    this.currentAccount = null;
  }

  async getAccessToken() {
    await this.init();
    
    const account = this.msalInstance.getActiveAccount();
    if (!account) {
      throw new Error('Tidak ada akun aktif. Silakan login terlebih dahulu.');
    }

    const tokenRequest = {
      scopes: GRAPH_SCOPES,
      account: account,
    };

    try {
      // Silent token acquisition
      const response = await this.msalInstance.acquireTokenSilent(tokenRequest);
      return response.accessToken;
    } catch (silentError) {
      if (silentError instanceof msal.InteractionRequiredAuthError) {
        // Fallback ke popup
        try {
          const response = await this.msalInstance.acquireTokenPopup(tokenRequest);
          return response.accessToken;
        } catch (popupError) {
          await this.msalInstance.acquireTokenRedirect(tokenRequest);
        }
      } else {
        throw silentError;
      }
    }
  }

  isLoggedIn() {
    if (!this.msalInstance) return false;
    const accounts = this.msalInstance.getAllAccounts();
    return accounts.length > 0;
  }

  getCurrentUser() {
    if (!this.msalInstance) return null;
    return this.msalInstance.getActiveAccount();
  }

  async getUserProfile() {
    const token = await this.getAccessToken();
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Gagal mengambil profil pengguna');
    return response.json();
  }

  async getUserPhoto() {
    try {
      const token = await this.getAccessToken();
      const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) return null;
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
}

const authService = new AuthService();
export default authService;
