"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, Bookmark, Gauge, LayoutDashboard, ListChecks, LogOut, Menu, Plug, Settings, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard",      label: "Dashboard",     icon: LayoutDashboard },
  { href: "/listings",       label: "Annonces",      icon: Gauge },
  { href: "/pipeline",       label: "Pipeline",      icon: ListChecks },
  { href: "/notifications",  label: "Notifications", icon: Bell, badge: true },
  { href: "/saved",          label: "Favoris",       icon: Bookmark },
  { href: "/alerts",         label: "Alertes",       icon: SlidersHorizontal },
  { href: "/sources",        label: "Sources",       icon: Plug },
  { href: "/admin/scrapers", label: "Monitoring",    icon: Activity },
  { href: "/settings",       label: "Paramètres",    icon: Settings },
];

export function MobileNav({ dealership, unseen }: { dealership: string; unseen: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30">
            <SlidersHorizontal size={14} />
          </span>
          VO Radar
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          aria-label="Menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close"
          />
          <aside className="absolute right-0 top-0 h-full w-72 border-l border-[var(--border)] bg-[var(--card)] p-4 shadow-2xl">
            <div className="mb-6 px-2">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Connecté</div>
              <div className="mt-0.5 truncate font-medium">{dealership}</div>
            </div>
            <nav className="flex flex-col gap-1">
              {items.map((it) => {
                const active = path === it.href || path?.startsWith(it.href + "/");
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition",
                      active ? "bg-neutral-800/80 text-white" : "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200",
                    )}
                  >
                    <Icon size={16} />
                    <span className="flex-1">{it.label}</span>
                    {it.badge && unseen > 0 && (
                      <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                        {unseen > 99 ? "99+" : unseen}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <form action="/api/auth/logout" method="post" className="mt-6">
              <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-neutral-500 hover:bg-neutral-800/40 hover:text-neutral-200">
                <LogOut size={16} /> Déconnexion
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
