"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { usePortfolio, type MutationResult } from "@/components/portfolio-provider";
import {
  registerDocument,
  removeDocument,
  replaceDocument,
} from "@/lib/data/actions/documents";
import { validateDocumentFile } from "@/lib/document-validation";
import {
  associationExists,
  documentObjectPath,
  resolveAssociation,
  type ResolvedAssociation,
} from "@/lib/documents";
import { createClient } from "@/lib/supabase/client";
import type { DocumentInput, DocumentRecord } from "@/types/document";

export type DocumentRow = { document: DocumentRecord; association: ResolvedAssociation };

type DocumentsContextValue = {
  rows: DocumentRow[];
  uploadDocument: (input: DocumentInput, file: File) => Promise<MutationResult<DocumentRecord>>;
  replaceDocumentFile: (id: string, file: File) => Promise<MutationResult<DocumentRecord>>;
  deleteDocument: (id: string) => Promise<MutationResult<DocumentRecord>>;
  getFileUrl: (document: DocumentRecord, options?: { download?: boolean }) => Promise<string | null>;
};

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

const UPLOAD_FAILED = "The file couldn't be uploaded. Check your connection and try again.";
const BUCKET = "documents";
const SIGNED_URL_SECONDS = 120;

async function currentUserId(): Promise<string | null> {
  const { data, error } = await createClient().auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

async function removeObject(path: string) {
  await createClient().storage.from(BUCKET).remove([path]);
}

export function DocumentsProvider({
  revision,
  initialDocuments,
  children,
}: {
  revision: string;
  initialDocuments: DocumentRecord[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { properties, units, tenants, tenancies } = usePortfolio();
  const [state, setState] = useState({ revision, documents: initialDocuments });
  if (state.revision !== revision) setState({ revision, documents: initialDocuments });
  const documents = state.revision === revision ? state.documents : initialDocuments;

  const value = useMemo<DocumentsContextValue>(() => {
    const records = { properties, units, tenants, tenancies };

    function adopt(next: DocumentRecord[] | ((current: DocumentRecord[]) => DocumentRecord[])) {
      setState((current) => ({
        revision: current.revision,
        documents: typeof next === "function" ? next(current.documents) : next,
      }));
      router.refresh();
    }

    return {
      rows: documents
        .map((document) => ({ document, association: resolveAssociation(document, records) }))
        .sort((a, b) => b.document.uploadedAt.localeCompare(a.document.uploadedAt)),

      async uploadDocument(input, file) {
        const checked = validateDocumentFile(file);
        if (!checked.success) return { ok: false, error: checked.error };
        if (!associationExists(input.associationType, input.associatedRecordId, records)) {
          return { ok: false, error: "The record this document belongs to no longer exists." };
        }
        const userId = await currentUserId();
        if (!userId) return { ok: false, error: "Your session has expired. Log in again." };

        const id = crypto.randomUUID();
        const storagePath = documentObjectPath(userId, id, file.name);
        const uploaded = await createClient()
          .storage.from(BUCKET)
          .upload(storagePath, file, { contentType: checked.data.mimeType, upsert: false });
        if (uploaded.error) return { ok: false, error: UPLOAD_FAILED };

        const saved = await registerDocument({
          ...input,
          id,
          originalFileName: file.name,
          mimeType: checked.data.mimeType,
          fileSize: file.size,
          storagePath,
        });
        if (!saved.ok) {
          await removeObject(storagePath);
          return saved;
        }
        adopt((current) => [...current, saved.value]);
        return saved;
      },

      async replaceDocumentFile(id, file) {
        const existing = documents.find((document) => document.id === id);
        if (!existing) return { ok: false, error: "This document no longer exists." };
        const checked = validateDocumentFile(file);
        if (!checked.success) return { ok: false, error: checked.error };
        const userId = await currentUserId();
        if (!userId) return { ok: false, error: "Your session has expired. Log in again." };

        const storagePath = documentObjectPath(userId, id, file.name);
        const uploaded = await createClient()
          .storage.from(BUCKET)
          .upload(storagePath, file, { contentType: checked.data.mimeType, upsert: false });
        if (uploaded.error) return { ok: false, error: UPLOAD_FAILED };

        const saved = await replaceDocument(id, {
          originalFileName: file.name,
          mimeType: checked.data.mimeType,
          fileSize: file.size,
          storagePath,
        });
        if (!saved.ok) {
          await removeObject(storagePath);
          return saved;
        }
        adopt((current) => current.map((document) => (document.id === id ? saved.value.document : document)));
        return { ok: true, value: saved.value.document };
      },

      async deleteDocument(id) {
        const result = await removeDocument(id);
        if (!result.ok) return result;
        adopt((current) => current.filter((document) => document.id !== id));
        return result;
      },

      async getFileUrl(document, options) {
        const { data, error } = await createClient()
          .storage.from(BUCKET)
          .createSignedUrl(
            document.storagePath,
            SIGNED_URL_SECONDS,
            options?.download ? { download: document.originalFileName } : undefined,
          );
        if (error || !data?.signedUrl) return null;
        return data.signedUrl;
      },
    };
  }, [documents, properties, units, tenants, tenancies, router]);

  return <DocumentsContext value={value}>{children}</DocumentsContext>;
}

export function useDocuments(): DocumentsContextValue {
  const context = useContext(DocumentsContext);
  if (!context) {
    throw new Error("useDocuments must be used within a DocumentsProvider.");
  }
  return context;
}
