"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: [string, string][] }) {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-[1560px] gap-1 overflow-x-auto px-3 pb-2">
      {items.map(([href, label]) => {
        const active = href === "/app" ? path === "/app" : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-gold text-gold-ink" : "text-muted hover:bg-ink-3 hover:text-text"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
