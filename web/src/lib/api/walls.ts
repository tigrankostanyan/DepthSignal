import { apiClient } from './client.js';
import { WallCluster } from '../../types/market.js';

export async function getWallClusters(minVolumeUsd: number = 50000): Promise<WallCluster[]> {
  return apiClient<WallCluster[]>(`/api/walls?minVolume=${minVolumeUsd}`);
}
