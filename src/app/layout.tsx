import type { Metadata } from "next";
import "./globals.css";
import { CookieBanner } from "@/components/cookie-banner";

export const metadata: Metadata = {
  title: "VO Radar — Sourcing VO temps réel pour concessions",
  description: "Détectez les bonnes affaires VO avant vos concurrents. Agrégateur d'annonces, scoring automatique, alertes en temps réel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
