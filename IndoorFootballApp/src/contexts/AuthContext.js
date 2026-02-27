// src/contexts/AuthContext.js
/*import React, { createContext, useState, useEffect } from 'react';
import api from '../api/api';
import { saveToken, getToken, removeToken } from '../utils/storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);       // { id, name, role }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // try to load existing token & user
    const init = async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      try {
        setLoading(false);
      } catch (err) {
        await removeToken();
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.token) {
      await saveToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } else {
      return { success: false, error: res.data?.error || 'Login failed' };
    }
  };

  const logout = async () => {
    await removeToken();
    setUser(null);
  };

  const register = async (name, email, password, role='PLAYER') => {
    const res = await api.post('/auth/register', { name, email, password, role });
    // register returns message (verification email); do not auto-login until verified
    return res.data;
  };



  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};*/

import React, { createContext, useState, useEffect } from 'react';
import api from '../api/api';
import { saveToken, getToken, removeToken } from '../utils/storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [loading, setLoading] = useState(true);

  // 🔹 Load token when app starts
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await getToken();

        if (!token) {
          setLoading(false);
          return;
        }

        // If token exists, you can optionally decode it
        // OR call backend to fetch user profile

        // For now we just stop loading
        setLoading(false);

      } catch (err) {
        await removeToken();
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 🔹 LOGIN
  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });

      if (res.data?.token) {
        await saveToken(res.data.token);
        setUser(res.data.user);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };

    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Login failed',
      };
    }
  };

  // 🔹 REGISTER (UPDATED FOR ROLE SYSTEM)
  const register = async ({ name, email, password, role }) => {
    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        password,
        role,
      });

      return res.data;

    } catch (err) {
      throw new Error(
        err.response?.data?.error || 'Registration failed'
      );
    }
  };

  // 🔹 LOGOUT
  const logout = async () => {
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};