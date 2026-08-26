import { apiClient } from './client.js';
import { AuthResponse, UserDTO } from '../../types/api.js';

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await apiClient<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (typeof window !== 'undefined' && res.token) {
    localStorage.setItem('quantscreen_jwt', res.token);
  }
  return res;
}

export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  const res = await apiClient<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (typeof window !== 'undefined' && res.token) {
    localStorage.setItem('quantscreen_jwt', res.token);
  }
  return res;
}

export async function getMe(): Promise<UserDTO> {
  return apiClient<UserDTO>('/api/auth/me');
}
