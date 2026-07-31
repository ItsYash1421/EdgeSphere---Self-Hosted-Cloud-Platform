/**
 * EdgeSphere API client
 * Handles auth headers, token refresh, and error normalization using Redux Store.
 */
import { store } from '../store';
import { logout, setCredentials } from '../store/slices/authSlice';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false,
): Promise<T> {
  let token = null;
  let refreshToken = null;

  if (typeof window !== 'undefined') {
    const authState = store.getState().auth;
    token = authState.accessToken;
    refreshToken = authState.refreshToken;
  }

  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  // Handle 401 — try token refresh
  if (res.status === 401 && typeof window !== 'undefined') {
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE_URL}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const { accessToken, refreshToken: newRefresh } = await refreshRes.json();
          
          // Update Redux Store!
          const user = store.getState().auth.user;
          if (user) {
            store.dispatch(setCredentials({
              user,
              accessToken,
              refreshToken: newRefresh
            }));
          }

          // Retry original request with new token
          headers['Authorization'] = `Bearer ${accessToken}`;
          const retryRes = await fetch(`${BASE_URL}${path}`, {
            method, headers,
            body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
          });
          if (retryRes.ok) {
            if (retryRes.status === 204) return undefined as T;
            return retryRes.json();
          }
        }
      } catch {
        // Refresh failed — clear Redux tokens
        store.dispatch(logout());
        window.location.href = '/login';
      }
    }

    store.dispatch(logout());
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError('Unauthorized', 401, 'AUTH_002');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(errorData.message || `HTTP ${res.status}`, res.status, errorData.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => request<T>('POST', path, formData, true),
};

export default api;
export { ApiError };
