"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OPS_ACCENT } from "@/components/ops/ops-theme";
import {
  ADVANCED_NAV,
  PLATFORM_NAV,
  PRIMARY_NAV,
  TRADING_NAV,
  type NavLink,
} from "@/components/ops/nav-groups";

function NavPill({ link, active }: { link: NavLink; active: boolean }) {
  const accent = OPS_ACCENT[link.accent];
  return (
    <Link
      href={link.href}
      className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
        active
          ? `${accent.link} ring-1 ${accent.ring}`
          : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
      }`}
    >
      {link.label}
    </Link>
  );
}

function NavDropdown({
  label,
  links,
  isActive,
}: {
  label: string;
  links: NavLink[];
  isActive: (href: string) => boolean;
}) {
  const anyActive = links.some((l) => isActive(l.href));
  return (
    <details className="relative" open={anyActive ? undefined : false}>
      <summary
        className={`cursor-pointer list-none rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide [&::-webkit-details-marker]:hidden ${
          anyActive
            ? "text-amber-300/90 ring-1 ring-amber-500/25"
            : "text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-300"
        }`}
      >
        {label}
      </summary>
      <div className="absolute left-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block rounded px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${
              isActive(link.href)
                ? OPS_ACCENT[link.accent].link
                : "text-zinc-400 hover:bg-zinc-900"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

export default function DeskNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="hidden items-center gap-1 rounded-lg border border-zinc-800/90 bg-zinc-950/60 p-0.5 lg:flex"
      aria-label="Desk navigation"
    >
      {PRIMARY_NAV.map((link) => (
        <NavPill key={link.href} link={link} active={isActive(link.href)} />
      ))}
      <span className="mx-0.5 h-4 w-px bg-zinc-800" aria-hidden />
      <NavDropdown label="Trading" links={TRADING_NAV} isActive={isActive} />
      <NavDropdown label="Platform" links={PLATFORM_NAV} isActive={isActive} />
      <NavDropdown label="Advanced" links={ADVANCED_NAV} isActive={isActive} />
    </nav>
  );
}
