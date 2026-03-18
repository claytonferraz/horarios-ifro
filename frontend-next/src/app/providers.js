"use client";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          {children}
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
