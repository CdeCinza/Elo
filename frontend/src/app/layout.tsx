import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const serifFont = localFont({
  src: "../fonts/PlayfairDisplay.ttf",
  variable: "--font-serif",
  weight: "400 900",
  display: "swap",
});

const sansFont = localFont({
  src: "../fonts/PlusJakartaSans.ttf",
  variable: "--font-sans",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ELO Gastronomia • Cardápio Digital",
  description: "O melhor da nossa cozinha, na sua mesa.",
};

import { ToastProvider } from "@/components/ui/ToastProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${serifFont.variable} ${sansFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
