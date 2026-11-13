import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export interface ApiErrorResponse {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('tuntas_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      localStorage.removeItem('tuntas_token');
      localStorage.removeItem('tuntas_user');
      const pathname = window.location.pathname;
      if (!pathname.startsWith('/login') && !pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extract a human-readable error message from an API error response.
 */
export function extractApiErrorMessage(err: unknown, fallback = 'Terjadi kesalahan pada server.'): string {
  if (!err) return fallback;
  const axiosErr = err as AxiosError<ApiErrorResponse>;

  if (axiosErr.response?.data?.errors) {
    const errMap = axiosErr.response.data.errors;
    const firstKey = Object.keys(errMap)[0];
    if (firstKey && errMap[firstKey]?.[0]) {
      return errMap[firstKey][0];
    }
  }

  if (axiosErr.response?.data?.message) {
    return axiosErr.response.data.message;
  }

  if (axiosErr.message === 'Network Error') {
    return 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
  }

  if (axiosErr.code === 'ECONNABORTED') {
    return 'Permintaan ke server kehabisan waktu (timeout). Silakan coba lagi.';
  }

  if (axiosErr.response?.status === 403) {
    return 'Anda tidak memiliki akses untuk melakukan tindakan ini.';
  }

  if (axiosErr.response?.status === 404) {
    return 'Data yang diminta tidak ditemukan.';
  }

  if (axiosErr.response?.status === 429) {
    return 'Terlalu banyak permintaan. Silakan tunggu beberapa saat lagi.';
  }

  if (axiosErr.response && axiosErr.response.status >= 500) {
    return 'Server sedang mengalami gangguan internal. Silakan coba kembali nanti.';
  }

  return axiosErr.message || fallback;
}

/**
 * Extract field-specific validation errors from an AxiosError.
 */
export function getApiValidationErrors(err: unknown): Record<string, string[]> | null {
  const axiosErr = err as AxiosError<ApiErrorResponse>;
  return axiosErr.response?.data?.errors || null;
}

export default api;
