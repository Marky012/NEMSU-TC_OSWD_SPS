import React, { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../api/apiClient';

const normalizeCategory = (cat) => {
  if (!cat) return cat;
  return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login-json', { email, password });
      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.response?.data?.message || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const payload = { email: userData.email, first_name: userData.first_name, password: userData.password, privacy_consent: userData.privacy_consent };
      const response = await apiClient.post('/auth/register', payload);
      return { success: true, data: response.data, email: response.data?.email };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.response?.data?.message || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);