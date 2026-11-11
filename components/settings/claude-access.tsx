"use client";

import { useState } from "react";

import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listClaudeGrants, revokeClaudeGrant } from "@/lib/mcp/grants";
import type { GrantSummary } from "@/lib/mcp/oauth/types";

export function ClaudeAccess() {
  const [grants, setGrants] = useState<GrantSummary[] | null>(null);
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const lock = useSubmitLock();

  async function load() {
    const result = await listClaudeGrants();
    if (!result.ok) {
      setError(result.error);
      setGrants(null);
      return;
    }
    setError(undefined);
    setGrants(result.grants);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Claude
        </CardTitle>
        <CardDescription>
          Connections you approved for Claude. Disconnecting stops that connector from reading or changing your
          portfolio. It does not delete any records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!loaded ? (
          <Button
            variant="outline"
            onClick={() => {
              setLoaded(true);
              void load();
            }}
          >
            Show connections
          </Button>
        ) : grants === null && !error ? (
          <p className="text-sm text-muted-foreground">Loading connections…</p>
        ) : grants === null ? null : grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Claude connection is active for this account.</p>
        ) : (
          <ul className="space-y-3">
            {grants.map((grant) => (
              <li key={grant.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{grant.clientLabel}</span>
                  <span className="block text-muted-foreground">
                    Connected {new Date(grant.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </span>
                <form
                  action={async () => {
                    if (!lock.acquire()) return;
                    const result = await revokeClaudeGrant(grant.id);
                    if (!result.ok) {
                      setError(result.error);
                      lock.release();
                      return;
                    }
                    setGrants((current) => current?.filter((item) => item.id !== grant.id) ?? []);
                    lock.release();
                  }}
                >
                  <SubmitButton pending={lock.pending} pendingLabel="Disconnecting…" variant="outline">
                    Disconnect
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <FormError message={error} />
      </CardContent>
    </Card>
  );
}
