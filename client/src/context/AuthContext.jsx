import React, { createContext, useState, useEffect, useCallback } from 'react';
import {
  getSessionUser,
  loginUser,
  registerUser,
  logoutUser,
  updateMyProfile,
  submitVerification as apiSubmitVerification,
} from '../services/api.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialChecked, setInitialChecked] = useState(false);

  // Checks active session on mount
  const checkSession = useCallback(async () => {
    try {
      const response = await getSessionUser();
      if (response?.success && response.data) {
        setUser(response.data.user);
        setProfile(response.data.profile);
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch {
      // 401 unauthenticated or network error means no active session
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
      setInitialChecked(true);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email, password) => {
    const response = await loginUser({ email, password });
    if (response?.success && response.data) {
      setUser(response.data.user);
      setProfile(response.data.profile);
      return response.data;
    }
    throw new Error(response?.error?.message || 'Login failed');
  };

  const register = async (fullName, email, password) => {
    const response = await registerUser({ fullName, email, password });
    if (response?.success && response.data) {
      setUser(response.data.user);
      setProfile(response.data.profile);
      return response.data;
    }
    throw new Error(response?.error?.message || 'Registration failed');
  };

  const logout = async () => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  const editProfile = async (profileData) => {
    const response = await updateMyProfile(profileData);
    if (response?.success && response.data) {
      setProfile(response.data);
      return response.data;
    }
    throw new Error(response?.error?.message || 'Failed to update profile');
  };

  const requestVerification = async () => {
    const response = await apiSubmitVerification();
    if (response?.success && response.data) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              verificationStatus: response.data.verificationStatus,
            }
          : null
      );
      return response.data;
    }
    throw new Error(response?.error?.message || 'Verification submission failed');
  };

  const value = {
    user,
    profile,
    loading,
    initialChecked,
    isAuthenticated: Boolean(user),
    isVerified: profile?.verificationStatus === 'verified',
    login,
    register,
    logout,
    editProfile,
    requestVerification,
    refreshSession: checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
