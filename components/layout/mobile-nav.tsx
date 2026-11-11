"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1.5 lg:hidden"
            aria-label="Open navigation"
          />
        }
      >
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <AppSidebar onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
