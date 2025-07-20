// frontend/src/context/AuthContext.js

import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Stores user info (id, username, email)
  const [token, setToken] = useState(localStorage.getItem('token')); // Stores JWT token
  const [loading, setLoading] = useState(true); // To indicate if initial load/check is complete

  // Effect to check for token in localStorage on initial load
  useEffect(() => {
    if (token) {
      // In a real app, you might want to validate the token with a backend call
      // For now, we'll assume a token means we're logged in.
      // You could also decode the JWT to get user info if it's stored in the token payload.
      // For simplicity, we'll rely on the login/register response to set user.
      // For existing sessions, we'd need a /api/auth/me endpoint or similar to get user details
      // based on the stored token.
      // Let's set a placeholder user for now if token exists but no user info is loaded.
      // A more robust solution would be to make an API call to validate the token and fetch user details.
      setLoading(false); // Assume logged in if token exists for now
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('token', data.token); // Store token in local storage
    } else {
      throw new Error(data.message || 'Login failed');
    }
  };

  const register = async (username, email, password) => {
    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('token', data.token); // Store token in local storage
    } else {
      throw new Error(data.message || 'Registration failed');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token'); // Remove token from local storage
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user, // Convenience boolean
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} {/* Render children only after initial token check */}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext easily
export const useAuth = () => {
  return useContext(AuthContext);
};