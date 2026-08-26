import { useState, useEffect } from 'react';
import { getMe } from '../lib/api/auth.js';
import { UserDTO } from '../types/api.js';

export function useAuth() {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem('quantscreen_jwt');
    setUser(null);
  };

  return { user, loading, logout, isAuthenticated: !!user };
}
