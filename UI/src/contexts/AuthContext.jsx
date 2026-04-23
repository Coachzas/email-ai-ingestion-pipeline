import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS, STORAGE_KEYS } from '../constants';

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
  const [token, setTokenState] = useState(localStorage.getItem(STORAGE_KEYS.TOKEN));

  // Separate function to update token without triggering re-render
  const setToken = (newToken) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
    setTokenState(newToken);
  };

  useEffect(() => {
    if (token) {
      // Verify token with server
      fetch(API_ENDPOINTS.AUTH.ME, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success && data.data) {
          setUser(data.data);
        } else {
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          setTokenState(null);
        }
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        setTokenState(null);
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []); // Run once on mount

  const login = async (email, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.SIGNIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        const token = data.data.session.access_token;
        setToken(token);
        setUser(data.data.user);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: 'Login failed' };
    }
  };

  const signup = async (email, password, name) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.SIGNUP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (data.success) {
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: 'Signup failed' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    login,
    signup,
    logout,
    loading,
    token,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
