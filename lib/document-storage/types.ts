/**
 * Where document files live. Document metadata is kept separately and refers
 * to a file only by its storage path, so adapters can be swapped (in-memory
 * today, Supabase Storage later) without changing the document UI.
 */
export interface DocumentStorage {
  /** Stores a file at `storagePath`. Rejects if the file can't be stored. */
  upload(storagePath: string, file: Blob, contentType: string): Promise<void>;
  /**
   * A short-lived URL the browser can preview or download, or null when no
   * file is stored at the path. `downloadAs` asks for a download with that
   * file name where the backend supports it.
   */
  getFileUrl(storagePath: string, options?: { downloadAs?: string }): Promise<string | null>;
  /** Removes the file. Resolves even if nothing is stored at the path. */
  remove(storagePath: string): Promise<void>;
}
