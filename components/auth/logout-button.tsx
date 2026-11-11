"use client";

import { LogOut } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm" aria-label="Log out">
        <LogOut data-icon="inline-start" />
        Log out
      </Button>
    </form>
  );
}
