"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { cn } from "cn";
import { CircleAlert, CircleCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type NoticeMessage = {
  tone: "success" | "error";
  title: string;
  message: React.ReactNode;
  /** Optional follow-up, e.g. a link to the record that changed. */
  action?: { label: string; onClick: () => void };
};

type NoticeProps = {
  notice: NoticeMessage | null;
  onDismiss: () => void;
};

/** Confirms a completed change, or reports one that failed. Shown by NoticeProvider. */
function Notice({ notice, onDismiss }: NoticeProps) {
  const success = notice?.tone === "success";
  const Icon = success ? CircleCheck : CircleAlert;
  return (
    <div
      role={notice?.tone === "error" ? "alert" : "status"}
      aria-live={notice?.tone === "error" ? "assertive" : "polite"}
      className="pointer-events-none fixed inset-x-4 bottom-4 z-40 sm:left-auto sm:w-96"
    >
      {notice && (
        <div
          className={cn(
            "pointer-events-auto flex gap-3 rounded-xl border p-4 text-sm shadow-lg",
            success
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-destructive/30 bg-background text-foreground",
          )}
        >
          <Icon
            className={cn("mt-0.5 size-5 shrink-0", !success && "text-destructive")}
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">{notice.title}</p>
            <div className="space-y-1 break-words">{notice.message}</div>
            {notice.action && (
              <Button
                variant="link"
                className={cn("h-auto p-0", success && "text-emerald-950 dark:text-emerald-100")}
                onClick={notice.action.onClick}
              >
                {notice.action.label}
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className={cn(
              "-mt-1 -mr-1 shrink-0",
              success &&
                "text-emerald-950 hover:bg-emerald-100 dark:text-emerald-100 dark:hover:bg-emerald-900",
            )}
          >
            <X />
          </Button>
        </div>
      )}
    </div>
  );
}

type NoticeContextValue = {
  showNotice: (notice: NoticeMessage | null) => void;
  clearNotice: () => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

/** Shows one notice at a time for the whole app, so notices never stack on top of each other. */
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<NoticeMessage | null>(null);
  const value = useMemo<NoticeContextValue>(
    () => ({ showNotice: setMessage, clearNotice: () => setMessage(null) }),
    [],
  );
  return (
    <NoticeContext value={value}>
      {children}
      <Notice notice={message} onDismiss={() => setMessage(null)} />
    </NoticeContext>
  );
}

export function useNotice(): NoticeContextValue {
  const context = useContext(NoticeContext);
  if (!context) {
    throw new Error("useNotice must be used within a NoticeProvider.");
  }
  return context;
}
