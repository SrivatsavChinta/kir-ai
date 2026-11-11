"use server";

import { dbError } from "@/lib/data/errors";
import { mapDocument, type DocumentRow } from "@/lib/data/mappers";
import { readPortfolioSlice, requireSession } from "@/lib/data/workspace";
import {
  ALLOWED_FILE_TYPES_LABEL,
  associationExists,
  detectDocumentMimeType,
  isOwnDocumentObject,
  MAX_DOCUMENT_FILE_SIZE,
  MAX_DOCUMENT_NAME_LENGTH,
} from "@/lib/documents";
import { formatFileSize } from "@/lib/format";
import type { MutationResult } from "@/lib/mutation";
import type { DocumentInput, DocumentMimeType, DocumentRecord } from "@/types/document";

const BUCKET = "documents";
const SIGNED_URL_SECONDS = 120;

export type StoredDocumentInput = DocumentInput & {
  id: string;
  originalFileName: string;
  mimeType: DocumentMimeType;
  fileSize: number;
  storagePath: string;
};

export async function registerDocument(input: StoredDocumentInput): Promise<MutationResult<DocumentRecord>> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!input.name.trim()) return { ok: false, error: "Enter a name for the document." };
  if (input.name.trim().length > MAX_DOCUMENT_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_DOCUMENT_NAME_LENGTH} characters or fewer.` };
  }
  const fileError = checkFile(input.originalFileName, input.mimeType, input.fileSize);
  if (fileError) return { ok: false, error: fileError };
  if (!isOwnDocumentObject(input.storagePath, session.userId, input.id)) {
    return { ok: false, error: "The uploaded file wasn't stored for this document." };
  }
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  if (!associationExists(input.associationType, input.associatedRecordId, portfolio)) {
    return { ok: false, error: "The record this document belongs to no longer exists." };
  }

  const { data, error } = await session.supabase
    .from("documents")
    .insert({
      id: input.id,
      landlord_id: session.userId,
      name: input.name.trim(),
      category: input.category,
      description: input.description?.trim() || null,
      association_type: input.associationType,
      associated_record_id: input.associatedRecordId,
      original_file_name: input.originalFileName,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      storage_path: input.storagePath,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, value: mapDocument(data as DocumentRow) };
}

export async function replaceDocument(
  id: string,
  file: { originalFileName: string; mimeType: DocumentMimeType; fileSize: number; storagePath: string },
): Promise<MutationResult<{ document: DocumentRecord; previousPath: string }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const fileError = checkFile(file.originalFileName, file.mimeType, file.fileSize);
  if (fileError) return { ok: false, error: fileError };
  if (!isOwnDocumentObject(file.storagePath, session.userId, id)) {
    return { ok: false, error: "The uploaded file wasn't stored for this document." };
  }

  const { data: existing, error: readError } = await session.supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: dbError(readError) };
  if (!existing) return { ok: false, error: "This document no longer exists." };
  const previous = existing as DocumentRow;
  if (previous.storage_path === file.storagePath) {
    return { ok: false, error: "Choose a different file." };
  }

  const { data, error } = await session.supabase
    .from("documents")
    .update({
      original_file_name: file.originalFileName,
      mime_type: file.mimeType,
      file_size: file.fileSize,
      storage_path: file.storagePath,
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "This document no longer exists." };

  if (isOwnDocumentObject(previous.storage_path, session.userId, id)) {
    await session.supabase.storage.from(BUCKET).remove([previous.storage_path]);
  }
  return {
    ok: true,
    value: { document: mapDocument(data as DocumentRow), previousPath: previous.storage_path },
  };
}

export async function removeDocument(id: string): Promise<MutationResult<DocumentRecord>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { data: existing, error: readError } = await session.supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: dbError(readError) };
  if (!existing) return { ok: false, error: "This document has already been deleted." };
  const row = existing as DocumentRow;

  const { error } = await session.supabase.from("documents").delete().eq("id", id);
  if (error) return { ok: false, error: dbError(error) };
  if (isOwnDocumentObject(row.storage_path, session.userId, id)) {
    await session.supabase.storage.from(BUCKET).remove([row.storage_path]);
  }
  return { ok: true, value: mapDocument(row) };
}

export async function createDocumentUrl(
  storagePath: string,
  downloadAs?: string,
): Promise<{ ok: true; url: string } | { ok: false; url: null }> {
  const session = await requireSession();
  if (!session.ok) return { ok: false, url: null };
  const { data, error } = await session.supabase.storage.from(BUCKET).createSignedUrl(
    storagePath,
    SIGNED_URL_SECONDS,
    downloadAs ? { download: downloadAs } : undefined,
  );
  if (error || !data?.signedUrl) return { ok: false, url: null };
  return { ok: true, url: data.signedUrl };
}

function checkFile(fileName: string, mimeType: string, fileSize: number): string | null {
  const detected = detectDocumentMimeType(fileName, mimeType);
  if (!detected) {
    return `"${fileName}" isn't a supported file type. Upload a ${ALLOWED_FILE_TYPES_LABEL} file.`;
  }
  if (fileSize <= 0) return "This file is empty. Choose another file.";
  if (fileSize > MAX_DOCUMENT_FILE_SIZE) {
    return `This file is larger than ${formatFileSize(MAX_DOCUMENT_FILE_SIZE)} (${formatFileSize(fileSize)}). Choose a smaller file.`;
  }
  return null;
}
