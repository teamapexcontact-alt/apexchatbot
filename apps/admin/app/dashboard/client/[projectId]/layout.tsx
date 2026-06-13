"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { use } from "react";

const navItems = [
  { href: "faqs", label: "FAQs", icon: "❓" },
  { href: "documents", label: "Documents", icon: "📄" },
  { href: "leads", label: "Leads", icon: "📋" },
  { href: "orders", label: "Orders", icon: "📦" },
  { href: "settings", label: "Settings", icon: "⚙️" },
];

export default function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/dashboard/projects" className="text-xs text-indigo-400 hover:underline">&larr; Back to Projects</Link>
          <h1 className="text-lg font-bold mt-1">Project: <span className="text-indigo-400">{projectId}</span></h1>
        </div>
      </div>
      <nav className="mb-6 flex gap-1 border-b border-neutral-800 pb-2 overflow-x-auto">
        {navItems.map((item) => {
          const active = pathname.endsWith(item.href);
          return (
            <Link key={item.href} href={`/dashboard/client/${projectId}/${item.href}`} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition ${active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"}`}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
