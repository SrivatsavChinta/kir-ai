import {
  Building2,
  Files,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const primaryNav: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Properties", href: "/properties", icon: Building2 },
  { title: "Tenants", href: "/tenants", icon: Users },
  { title: "Rent & Payments", href: "/payments", icon: Wallet },
  { title: "Documents", href: "/documents", icon: Files },
  { title: "Maintenance", href: "/maintenance", icon: Wrench },
];

export const secondaryNav: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Help & Support", href: "/help", icon: LifeBuoy },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPageTitle(pathname: string): string {
  const item = [...primaryNav, ...secondaryNav].find((navItem) =>
    isActivePath(pathname, navItem.href),
  );
  return item?.title ?? "kir.ai";
}
