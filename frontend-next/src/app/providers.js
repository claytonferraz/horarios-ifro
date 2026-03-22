"use client";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { AlertProvider } from "@/contexts/AlertContext";

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AlertProvider>
        <AuthProvider>
          <DataProvider>
            {children}
          </DataProvider>
        </AuthProvider>
      </AlertProvider>
    </ThemeProvider>
  );
}
