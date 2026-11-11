import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Actor } from "@/lib/data/actor";

type Row = Record<string, unknown>;

/**
 * A tiny PostgREST stand-in. Each client only sees and changes rows whose
 * landlord_id matches, which is the behaviour row level security provides.
 */
export function createMemoryPortfolio() {
  const tables = new Map<string, Row[]>();

  function rows(name: string): Row[] {
    let table = tables.get(name);
    if (!table) {
      table = [];
      tables.set(name, table);
    }
    return table;
  }

  function client(landlordId: string): SupabaseClient {
    return {
      from(name: string) {
        return new Query(rows(name), landlordId);
      },
    } as unknown as SupabaseClient;
  }

  function actor(landlordId: string, email = `${landlordId}@example.com`): Actor {
    return { supabase: client(landlordId), userId: landlordId, email };
  }

  return { actor, rows };
}

class Query implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null; count?: number | null }> {
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private filters: [string, unknown][] = [];
  private patch: Row | null = null;
  private inserted: Row[] = [];
  private head = false;
  private selected = false;

  constructor(
    private table: Row[],
    private landlordId: string,
  ) {}

  select(_columns?: string, options?: { head?: boolean }) {
    this.selected = true;
    this.head = Boolean(options?.head);
    return this;
  }

  insert(row: Row | Row[]) {
    this.operation = "insert";
    this.inserted = Array.isArray(row) ? row : [row];
    return this;
  }

  update(patch: Row) {
    this.operation = "update";
    this.patch = patch;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order() {
    return this;
  }

  maybeSingle() {
    return this.one(false);
  }

  single() {
    return this.one(true);
  }

  then<TResult1 = { data: unknown; error: { message: string; code?: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string; code?: string } | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.many()).then(onfulfilled, onrejected);
  }

  private one(required: boolean) {
    const result = this.many();
    if (result.error) return Promise.resolve(result);
    const rows = Array.isArray(result.data) ? result.data : [];
    if (rows.length === 1) return Promise.resolve({ data: rows[0], error: null });
    if (!required && rows.length === 0) return Promise.resolve({ data: null, error: null });
    return Promise.resolve({
      data: null,
      error: { message: "JSON object requested, multiple (or no) rows returned" },
    });
  }

  private many() {
    const visible = this.table.filter((row) => row.landlord_id === this.landlordId);
    const matched = visible.filter((row) => this.filters.every(([column, value]) => row[column] === value));

    if (this.operation === "insert") {
      const created: Row[] = [];
      for (const input of this.inserted) {
        if (input.landlord_id !== this.landlordId) {
          return { data: null, error: { message: "new row violates row-level security policy", code: "42501" }, count: null };
        }
        const row = {
          id: randomUUID(),
          created_at: new Date().toISOString(),
          ...input,
        };
        this.table.push(row);
        created.push(row);
      }
      return { data: this.selected ? created : null, error: null, count: null };
    }

    if (this.head) return { data: null, error: null, count: matched.length };

    if (this.operation === "delete") {
      for (const row of matched) {
        const index = this.table.indexOf(row);
        if (index >= 0) this.table.splice(index, 1);
      }
      return { data: null, error: null, count: matched.length };
    }

    if (this.operation === "update" && this.patch) {
      for (const row of matched) Object.assign(row, this.patch);
      return { data: this.selected ? matched : null, error: null, count: matched.length };
    }

    return { data: matched, error: null, count: matched.length };
  }
}
