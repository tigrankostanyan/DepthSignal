import { apiClient } from './client.js';

export interface WatchlistDTO {
  id: string;
  name: string;
  color?: string;
  symbols: string[];
}

export async function getWatchlists(): Promise<WatchlistDTO[]> {
  return apiClient<WatchlistDTO[]>('/api/watchlists');
}

export async function saveWatchlist(name: string, symbols: string[], color?: string): Promise<WatchlistDTO> {
  return apiClient<WatchlistDTO>('/api/watchlists', {
    method: 'POST',
    body: JSON.stringify({ name, symbols, color })
  });
}
