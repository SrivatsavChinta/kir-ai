"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useSettings } from "@/components/settings/settings-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { getPageTitle } from "@/lib/navigation";
import { getInitials } from "@/lib/format";

function PageTitle() {
  return (
    <p className="min-w-0 truncate text-sm font-medium">
      {getPageTitle(usePathname())}
    </p>
  );
}

export function AppHeader({ showLogout = false }: { showLogout?: boolean }) {
  const { profile } = useSettings().settings;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 sm:px-6 lg:px-8">
      <MobileNav />

      <Suspense fallback={null}>
        <PageTitle />
      </Suspense>

      <div className="ml-auto flex items-center gap-1">
        {showLogout && <LogoutButton />}
        <Link
          href="/settings"
          className={buttonVariants({ variant: "ghost", size: "icon", className: "rounded-full" })}
          aria-label={`Profile and settings for ${profile.fullName}`}
        >
          <Avatar size="sm">
            <AvatarFallback className="bg-sidebar-accent text-[10px] font-medium text-sidebar-accent-foreground">
              {getInitials(profile.fullName)}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
