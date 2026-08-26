export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UserDTO {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  tier: 'FREE' | 'PRO' | 'ADVANCED';
  createdAt: string;
}

export interface AuthResponse {
  user: UserDTO;
  token: string;
}
