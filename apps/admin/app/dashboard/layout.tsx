"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/projects", label: "Projects", icon: "📁" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
  { href: "/dashboard/seed", label: "Seed Data", icon: "🌱" },
  { href: "/widget-preview.html", label: "Widget Preview", icon: "👁️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-40 w-56 border-r border-neutral-800 bg-neutral-950 p-4 transition-transform lg:static lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold tracking-tight">APEX</h2>
          <button onClick={() => setMenuOpen(false)} className="lg:hidden text-neutral-400 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <p className="mb-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Super Admin</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"}`}>
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {menuOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <button onClick={() => setMenuOpen(true)} className="mb-4 flex items-center gap-2 text-sm text-neutral-400 hover:text-white lg:hidden">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          Menu
        </button>
        {children}
      </main>
    </div>
  );
}
