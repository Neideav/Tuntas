import axios, { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export interface ApiErrorResponse {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

// In-memory cache map: key -> { data, timestamp, ttl }
export const apiCache = new Map<string, CacheEntry>();

// In-flight request deduplication map: key -> Promise
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Get synchronously cached data for an endpoint if still valid.
 */
export function getCachedData<T = any>(url: string, params?: Record<string, any>): T | null {
  const key = buildCacheKey(url, params);
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    apiCache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Store data into the client-side API cache.
 */
export function setCachedData<T = any>(url: string, data: T, ttlMs = 45000, params?: Record<string, any>): void {
  const key = buildCacheKey(url, params);
  apiCache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

/**
 * Invalidate cached endpoints by string prefix or RegExp.
 */
export function invalidateApiCache(urlPattern?: string | RegExp): void {
  if (!urlPattern) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (typeof urlPattern === 'string' ? key.includes(urlPattern) : urlPattern.test(key)) {
      apiCache.delete(key);
    }
  }
}

function buildCacheKey(url: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) return url;
  return `${url}?${new URLSearchParams(params as any).toString()}`;
}

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('tuntas_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Invalidate related caches on mutating operations
    const method = response.config.method?.toLowerCase();
    const url = response.config.url || '';

    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      if (url.includes('/tasks') || url.includes('/subtasks')) {
        invalidateApiCache('/tasks');
        invalidateApiCache('/dashboard');
        invalidateApiCache('/analytics');
        invalidateApiCache('/calendar');
      } else if (url.includes('/habits')) {
        invalidateApiCache('/habits');
        invalidateApiCache('/dashboard');
        invalidateApiCache('/analytics');
      } else if (url.includes('/projects')) {
        invalidateApiCache('/projects');
        invalidateApiCache('/dashboard');
      } else if (url.includes('/goals')) {
        invalidateApiCache('/goals');
        invalidateApiCache('/dashboard');
      } else if (url.includes('/exam') || url.includes('/question-bank') || url.includes('/courses')) {
        invalidateApiCache('/examinations');
        invalidateApiCache('/learning');
        invalidateApiCache('/dashboard');
      } else if (url.includes('/notifications')) {
        invalidateApiCache('/notifications');
        invalidateApiCache('/dashboard');
      } else if (url.includes('/categories') || url.includes('/tags')) {
        invalidateApiCache('/categories');
        invalidateApiCache('/tags');
        invalidateApiCache('/tasks');
        invalidateApiCache('/dashboard');
      } else if (url.includes('/auth')) {
        apiCache.clear();
      }
    }

    return response;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      localStorage.removeItem('tuntas_token');
      localStorage.removeItem('tuntas_user');
      apiCache.clear();
      const pathname = window.location.pathname;
      if (!pathname.startsWith('/login') && !pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Intercept api.get to implement in-flight deduplication and cache population
const rawGet = api.get.bind(api);
(api as any).get = function <T = any, R = AxiosResponse<T>>(
  url: string,
  config?: any
): Promise<R> {
  const cacheKey = buildCacheKey(url, config?.params);

  // If identical request is already currently in flight, reuse the active promise
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<R>;
  }

  const promise = (rawGet as any)(url, config)
    .then((res: any) => {
      // Auto cache successful GET response data for 45 seconds
      if (res?.data && res.data.success !== false) {
        setCachedData(url, res.data.data ?? res.data, 45000, config?.params);
      }
      return res;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, promise);
  return promise as Promise<R>;
};

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
    return 'Gagal terhubung ke server. Periksa koneksi backend Anda.';
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
