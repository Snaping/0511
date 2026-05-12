import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  const initAuth = useCallback(async () => {
    const token = localStorage.getItem('eim_token');
    const savedUser = localStorage.getItem('eim_user');

    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);

        const { data } = await authAPI.getCurrentUser();
        setUser(data.user);
        localStorage.setItem('eim_user', JSON.stringify(data.user));

        const newSocket = connectSocket(token);
        setSocket(newSocket);
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('eim_token');
        localStorage.removeItem('eim_user');
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    initAuth();
    return () => {
      if (socket) {
        disconnectSocket();
      }
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    const userWithOnlineStatus = { ...data.user, status: 'online' };
    localStorage.setItem('eim_token', data.token);
    localStorage.setItem('eim_user', JSON.stringify(userWithOnlineStatus));
    setUser(userWithOnlineStatus);

    const newSocket = connectSocket(data.token);
    setSocket(newSocket);

    return data;
  };

  const register = async (userData) => {
    const { data } = await authAPI.register(userData);
    const userWithOnlineStatus = { ...data.user, status: 'online' };
    localStorage.setItem('eim_token', data.token);
    localStorage.setItem('eim_user', JSON.stringify(userWithOnlineStatus));
    setUser(userWithOnlineStatus);

    const newSocket = connectSocket(data.token);
    setSocket(newSocket);

    return data;
  };

  const logout = () => {
    if (socket) {
      disconnectSocket();
      setSocket(null);
    }
    localStorage.removeItem('eim_token');
    localStorage.removeItem('eim_user');
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('eim_user', JSON.stringify(userData));
  };

  const value = {
    user,
    socket,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};