"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Bookmark, Gauge, LayoutDashboard, ListChecks, LogOut, Plug, Settings, SlidersHorizontal, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const items = [
  { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/listings",      label: "Annonces",      icon: Gauge },
  { href: "/pipeline",      label: "Pipeline",      icon: ListChecks },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: true },
  { href: "/saved",         label: "Favoris",       icon: Bookmark },
  { href: "/alerts",        label: "Alertes",       icon: SlidersHorizontal },
  { href: "/analytics",     label: "Analytics",     icon: BarChart3 },
  { href: "/sources",       label: "Sources",       icon: Plug },
  { href: "/admin/scrapers", label: "Monitoring",   icon: Activity },
  { href: "/settings",      label: "Paramètres",    icon: Settings },
];

export function SideNav({ dealership, unseen }: { dealership: string; unseen: number }) {
  const path = usePathname();
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] p-4 lg:flex">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
        <Logo variant="icon" size={30} />
        <div className="leading-tight">
          <div className="text-[14px] font-bold tracking-tight text-white leading-none">
            VO <span className="font-light tracking-[0.18em] text-rose-400">RADAR</span>
          </div>
          <div className="text-xs text-neutral-500 truncate max-w-[130px] mt-0.5">{dealership}</div>
        </div>
      </Link>
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = path === it.href || path?.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
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
      <form action="/api/auth/logout" method="post" className="mt-auto">
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-800/40 hover:text-neutral-200">
          <LogOut size={16} /> Déconnexion
        </button>
      </form>
    </aside>
  );
}
