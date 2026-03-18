import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: "Horários IFRO - Ji-Paraná",
  description: "Sistema de Horários do IFRO Campus Ji-Paraná",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Horários IFRO",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300 min-h-screen flex flex-col font-sans`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
