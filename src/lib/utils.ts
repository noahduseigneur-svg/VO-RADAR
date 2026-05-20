import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function fmtEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function fmtKm(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " km";
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`;
  return d.toLocaleDateString("fr-FR");
}

export function scoreColor(score: number): string {
  if (score >= 85) return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
  if (score >= 70) return "bg-lime-500/15 text-lime-400 ring-lime-500/30";
  if (score >= 50) return "bg-amber-500/15 text-amber-400 ring-amber-500/30";
  return "bg-rose-500/15 text-rose-400 ring-rose-500/30";
}

export function scoreLabel(score: number): string {
  if (score >= 85) return "Pépite";
  if (score >= 70) return "Bonne affaire";
  if (score >= 50) return "Correct";
  return "Surcôté";
}
