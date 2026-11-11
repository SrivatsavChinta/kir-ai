import { createMemoryDocumentStorage } from "@/lib/document-storage/memory-storage";
import type { DocumentStorage } from "@/lib/document-storage/types";

export type { DocumentStorage } from "@/lib/document-storage/types";

export type DocumentStorageOptions = {
  /** Storage paths of sample documents mapped to the static files that stand in for them. */
  seedFiles?: Record<string, string>;
};

/**
 * The document storage the app uses. This is the only place that picks an
 * adapter; a Supabase Storage adapter implementing `DocumentStorage` can be
 * returned here instead.
 */
export function createDocumentStorage({ seedFiles }: DocumentStorageOptions = {}): DocumentStorage {
  return createMemoryDocumentStorage({ seedFiles, latencyMs: 400 });
}
