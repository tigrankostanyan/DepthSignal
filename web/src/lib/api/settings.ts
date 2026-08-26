import { apiClient } from './client.js';
import { UserSettingsDTO } from '../../types/user.js';

export async function getUserSettings(): Promise<UserSettingsDTO> {
  return apiClient<UserSettingsDTO>('/api/settings');
}

export async function updateUserSettings(settings: Partial<UserSettingsDTO>): Promise<UserSettingsDTO> {
  return apiClient<UserSettingsDTO>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
}
