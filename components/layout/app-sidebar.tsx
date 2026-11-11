"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "lucide-react";

import { useSettings } from "@/components/settings/settings-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  isActivePath,
  primaryNav,
  secondaryNav,
  type NavItem,
} from "@/lib/navigation";
import { getInitials } from "@/lib/format";

type AppSidebarProps = {
  onNavigate?: () => void;
};

// usePathname suspends while prerendering routes with unknown dynamic params
// (e.g. /properties/[id]), so the fallback renders the sidebar without an active item.
export function AppSidebar({ onNavigate }: AppSidebarProps) {
  return (
    <Suspense fallback={<SidebarContent pathname={null} onNavigate={onNavigate} />}>
      <SidebarWithPathname onNavigate={onNavigate} />
    </Suspense>
  );
}

function SidebarWithPathname({ onNavigate }: AppSidebarProps) {
  return <SidebarContent pathname={usePathname()} onNavigate={onNavigate} />;
}

type SidebarContentProps = AppSidebarProps & {
  pathname: string | null;
};

function SidebarContent({ pathname, onNavigate }: SidebarContentProps) {
  const { profile, portfolio } = useSettings().settings;
  return (
    <div className="flex h-full flex-col text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center px-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <House className="size-4" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            kir.ai
          </span>
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <NavList items={primaryNav} pathname={pathname} onNavigate={onNavigate} />
      </nav>

      <div className="shrink-0 space-y-3 border-t border-sidebar-border px-3 py-3">
        <nav aria-label="Account">
          <NavList
            items={secondaryNav}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </nav>

        <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
          <Avatar>
            <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
              {getInitials(profile.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{profile.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile.accountType} · {portfolio.portfolioName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

type NavListProps = {
  items: NavItem[];
  pathname: string | null;
  onNavigate?: () => void;
};

function NavList({ items, pathname, onNavigate }: NavListProps) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ title, href, icon: Icon }) => {
        const isActive = pathname !== null && isActivePath(pathname, href);

        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className="group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-xs aria-[current=page]:ring-1 aria-[current=page]:ring-sidebar-border"
            >
              <Icon
                className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-sidebar-accent-foreground group-aria-[current=page]:text-foreground"
                aria-hidden
              />
              <span className="truncate">{title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
