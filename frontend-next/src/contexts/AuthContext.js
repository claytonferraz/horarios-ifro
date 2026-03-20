"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient, setToken } from "@/lib/apiClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [siape, setSiape] = useState(null);
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    checkInitialAuth();
  }, []);

  const checkInitialAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const storedUser = localStorage.getItem('@app:user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setIsUnlocked(true);
        setUserRole(userData.role || null);
        setSiape(userData.siape || null);
        setUserName(userData.nome_exibicao || null);
        if (userData.token) {
          setToken(userData.token);
        }
        setIsLoadingAuth(false);
        return;
      }

      // To validate token, we can just check local state or ping checkStatus
      const status = await apiClient.checkStatus();
      const isValid = !!status; // Naive check
      setIsUnlocked(isValid);
      setUserRole(isValid && status.role ? status.role : null);
      setSiape(isValid && status.id ? status.id : null);
      setUserName(isValid && status.nome_exibicao ? status.nome_exibicao : null);
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
          localStorage.setItem('@app:user', JSON.stringify(loginRes));
        }
        return res;
      } else {
        const res = await apiClient.login(username, password); // uses apiClient.login, not loginAdmin
        if (res && res.token) {
          setIsUnlocked(true);
          setToken(res.token);
          setUserRole(res.role || 'publico');
          setSiape(res.siape || null);
          setUserName(res.nome_exibicao || null);
          localStorage.setItem('@app:user', JSON.stringify(res));
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
    localStorage.removeItem('@app:user');
    setIsUnlocked(false);
    setUserRole(null);
    setSiape(null);
    setUserName(null);
    // Redirect immediately to clear memory and states
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider
      value={{ isUnlocked, userRole, siape, userName, isLoadingAuth, login, logout, checkInitialAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
