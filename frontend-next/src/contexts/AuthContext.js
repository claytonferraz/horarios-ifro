"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient, setToken } from "@/lib/apiClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    checkInitialAuth();
  }, []);

  const checkInitialAuth = async () => {
    setIsLoadingAuth(true);
    try {
      // To validate token, we can just check local state or ping checkStatus
      const status = await apiClient.checkStatus();
      const isValid = !!status; // Naive check
      setIsUnlocked(isValid);
      setUserRole(isValid && status.role ? status.role : null);
    } catch (e) {
      setIsUnlocked(false);
      setUserRole(null);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (username, password, mode = "login", confirm = "") => {
    try {
      if (mode === "setup") {
        if (password !== confirm) throw new Error("As senhas não coincidem.");
        const res = await apiClient.setupAdmin(username, password);
        const loginRes = await apiClient.login(username, password); 
        if (loginRes && loginRes.token) {
          setIsUnlocked(true);
          setToken(loginRes.token);
          setUserRole(loginRes.role || 'admin');
        }
        return res;
      } else {
        const res = await apiClient.login(username, password); // uses apiClient.login, not loginAdmin
        if (res && res.token) {
          setIsUnlocked(true);
          setToken(res.token);
          setUserRole(res.role || 'publico');
        }
        return res;
      }
    } catch (error) {
      console.error("Login falhou", error);
      throw error;
    }
  };

  const logout = () => {
    setToken('');
    localStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminToken");
    setIsUnlocked(false);
    setUserRole(null);
    // Redirect immediately to clear memory and states
    window.location.href = '/';
  };

  const changePassword = async (currentPassword, newPassword) => {
    return apiClient.changePassword(currentPassword, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{ isUnlocked, userRole, isLoadingAuth, login, logout, changePassword, checkInitialAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
