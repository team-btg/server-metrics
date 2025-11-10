import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
 
interface AuthContextType {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string | null) => void; 
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState(() => localStorage.getItem('token'));
  const navigate = useNavigate();

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('token', newToken);
    } else {
      localStorage.removeItem('token');
    }
  };
 
  const login = async (email: string, password: string) => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Login failed');
    }

    const data = await response.json();
    setToken(data.access_token);
    navigate('/'); 
  };

  const logout = () => {
    setToken(null); 
    navigate('/login'); 
  };
 
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'token') {
        setTokenState(event.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ token, login, logout, setToken }}>
      {children}
    </AuthContext.Provider>
  );
};
 
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};