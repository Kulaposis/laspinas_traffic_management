import axios from 'axios';

// Prefer env var, but gracefully fall back to localhost:8000 to avoid runtime crashes
const DEFAULT_API_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000';
const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
if (!import.meta.env.VITE_API_URL) {
  // Non-fatal: help developers notice missing config without breaking the app
  console.warn('[config] VITE_API_URL is not set; using fallback:', API_BASE_URL);
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000, // 8 second timeout to prevent 504 Gateway Timeout issues
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle network errors (backend not available) - don't log as errors
    if (!error.response && (error.message === 'Failed to fetch' || error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED')) {
      // Services will handle these gracefully by returning empty data
      // Don't log as error to reduce console noise
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401) {
      // Only force redirect if this app was using backend token auth
      const hadBackendToken = !!localStorage.getItem('access_token');
      if (hadBackendToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
