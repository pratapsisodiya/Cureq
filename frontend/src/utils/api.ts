import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
export const API_URL = `${BACKEND_URL}/api`;

// Retry config: 3 attempts with exponential backoff (400ms → 800ms → 1600ms)
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400;

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cureq_token') || '';
}

// Only retry on network failures or 5xx — never on 4xx client errors
function shouldRetry(status: number): boolean {
  return status === 0 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const axiosInstance = axios.create({ baseURL: API_URL });

axiosInstance.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Accepts both AxiosRequestConfig (new `data` field) and legacy fetch-style options
// (`body: JSON.stringify(...)`) so existing call sites keep working without changes.
type RequestOptions = AxiosRequestConfig & { body?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiRequest<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, method, ...rest } = options;

  // Convert legacy fetch-style `body` string to axios `data` object
  const axiosConfig: AxiosRequestConfig = {
    url: path,
    method: method ?? 'GET',
    ...rest,
    ...(body !== undefined ? { data: JSON.parse(body) } : {}),
  };

  let attempt = 0;

  while (true) {
    try {
      const response: AxiosResponse<T> = await axiosInstance(axiosConfig);
      return response.data;
    } catch (err: any) {
      const status: number = err?.response?.status ?? 0;
      const isLast = attempt >= MAX_RETRIES - 1;

      if (!shouldRetry(status) || isLast) {
        const message =
          err?.response?.data?.error ||
          err?.message ||
          `Request failed with status ${status}`;
        throw new Error(message);
      }

      await sleep(BASE_DELAY_MS * 2 ** attempt);
      attempt++;
    }
  }
}

// Typed convenience wrappers
export const api = {
  get: <T = unknown>(path: string, config?: AxiosRequestConfig) =>
    apiRequest<T>(path, { method: 'GET', ...config }),

  post: <T = unknown>(path: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>(path, { method: 'POST', data, ...config }),

  put: <T = unknown>(path: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>(path, { method: 'PUT', data, ...config }),

  delete: <T = unknown>(path: string, config?: AxiosRequestConfig) =>
    apiRequest<T>(path, { method: 'DELETE', ...config }),
};
