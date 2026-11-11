import type { DocumentStorage } from "@/lib/document-storage/types";

export type MemoryStorageOptions = {
  /** Storage paths served from static URLs, for sample documents. */
  seedFiles?: Record<string, string>;
  /** Simulated network delay, so pending states behave as they will with a real backend. */
  latencyMs?: number;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Keeps uploaded files as Blobs in this browser tab's memory. Nothing is
 * persisted: every uploaded file is lost when the page reloads.
 */
export function createMemoryDocumentStorage({
  seedFiles = {},
  latencyMs = 0,
}: MemoryStorageOptions = {}): DocumentStorage {
  const blobs = new Map<string, Blob>();
  const objectUrls = new Map<string, string>();
  const staticUrls = new Map(Object.entries(seedFiles));

  function forget(storagePath: string) {
    const url = objectUrls.get(storagePath);
    if (url) URL.revokeObjectURL(url);
    objectUrls.delete(storagePath);
    blobs.delete(storagePath);
    staticUrls.delete(storagePath);
  }

  return {
    async upload(storagePath, file, contentType) {
      await wait(latencyMs);
      forget(storagePath);
      blobs.set(
        storagePath,
        file.type === contentType ? file : new Blob([file], { type: contentType }),
      );
    },

    async getFileUrl(storagePath) {
      const blob = blobs.get(storagePath);
      if (blob) {
        let url = objectUrls.get(storagePath);
        if (!url) {
          url = URL.createObjectURL(blob);
          objectUrls.set(storagePath, url);
        }
        return url;
      }
      const staticUrl = staticUrls.get(storagePath);
      if (!staticUrl) return null;
      try {
        const response = await fetch(staticUrl, { method: "HEAD" });
        return response.ok ? staticUrl : null;
      } catch {
        return null;
      }
    },

    async remove(storagePath) {
      await wait(latencyMs);
      forget(storagePath);
    },
  };
}
