import type { UserProfile, CurrentUserResponse } from '@/types/index';
import { authFetch } from './api-core';

interface AuthResponse {
  user: UserProfile;
  expiresAt: number;
}

export interface AuthConfig {
  googleClientId: string;
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  return authFetch<AuthConfig>('/api/auth/config');
}

export async function googleLogin(idToken: string): Promise<UserProfile> {
  const res = await authFetch<AuthResponse>('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  return res.user;
}

export async function fetchCurrentUser(): Promise<CurrentUserResponse> {
  return authFetch<CurrentUserResponse>('/api/auth/me');
}

export async function logout(): Promise<void> {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
}
