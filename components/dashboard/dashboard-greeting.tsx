"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { IndianRupee, Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

function subscribe() {
  return () => {};
}

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// The visitor's local time is unknown during prerendering, so the server renders
// a neutral greeting and the client swaps in the time-of-day one.
function getServerGreeting(): string {
  return "Welcome back";
}

type DashboardGreetingProps = {
  firstName: string;
  portfolioName: string;
  dataNotice: string;
  onRecordPayment: () => void;
};

export function DashboardGreeting({
  firstName,
  portfolioName,
  dataNotice,
  onRecordPayment,
}: DashboardGreetingProps) {
  const greeting = useSyncExternalStore(
    subscribe,
    getTimeOfDayGreeting,
    getServerGreeting,
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight break-words">
          {greeting}, {firstName}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening across {portfolioName}.
        </p>
        <p className="text-xs text-muted-foreground">{dataNotice}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="outline" size="lg" onClick={onRecordPayment}>
          <IndianRupee data-icon="inline-start" />
          Record payment
        </Button>
        <Link href="/properties/new" className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" />
          Add property
        </Link>
      </div>
    </div>
  );
}
