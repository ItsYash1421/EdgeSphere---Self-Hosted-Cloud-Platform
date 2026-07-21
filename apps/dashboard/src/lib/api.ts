/**
 * EdgeSphere API client
 * Handles auth headers, token refresh, and error normalization.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

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
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE_URL}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const { accessToken, refreshToken: newRefresh } = await refreshRes.json();
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', newRefresh);

          // Retry original request with new token
          headers['Authorization'] = `Bearer ${accessToken}`;
          const retryRes = await fetch(`${BASE_URL}${path}`, {
            method, headers,
            body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
          });
          if (retryRes.ok) return retryRes.json();
        }
      } catch {
        // Refresh failed — clear tokens
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
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
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => request<T>('POST', path, formData, true),
};

export default api;
export { ApiError };
