"use client";

import { useState } from "react";

import { DeleteDocumentDialog } from "@/components/documents/delete-document-dialog";
import { DocumentPreviewDialog } from "@/components/documents/document-preview-dialog";
import { useDocuments } from "@/components/documents/documents-provider";
import { ReplaceDocumentDialog } from "@/components/documents/replace-document-dialog";
import {
  UploadDocumentDialog,
  type UploadPreset,
} from "@/components/documents/upload-document-dialog";
import { useNotice } from "@/components/feedback/notice";
import type { DocumentRecord } from "@/types/document";

export type DocumentActions = {
  upload: (preset?: UploadPreset) => void;
  view: (document: DocumentRecord) => void;
  download: (document: DocumentRecord) => void;
  replace: (document: DocumentRecord) => void;
  remove: (document: DocumentRecord) => void;
  /** Id of the document whose download is being prepared. */
  downloadingId?: string;
};

type DialogState = { open: boolean; key: number; document: DocumentRecord | null };

const closed: DialogState = { open: false, key: 0, document: null };

const MISSING_FILE_MESSAGE =
  "The file for this document couldn't be found. Replace the file to restore it.";

/** Document actions plus the dialogs and messages they open. Render `dialogs` once. */
export function useDocumentActions(): { actions: DocumentActions; dialogs: React.ReactNode } {
  const { getFileUrl } = useDocuments();
  const [upload, setUpload] = useState<{ open: boolean; key: number; preset?: UploadPreset }>({
    open: false,
    key: 0,
  });
  const [preview, setPreview] = useState<DialogState>(closed);
  const [replace, setReplace] = useState<DialogState>(closed);
  const [remove, setRemove] = useState<DialogState>(closed);
  const { showNotice: setNotice, clearNotice } = useNotice();
  const [downloadingId, setDownloadingId] = useState<string>();

  function open(setter: typeof setPreview, document: DocumentRecord) {
    clearNotice();
    setter((state) => ({ open: true, key: state.key + 1, document }));
  }

  async function download(document: DocumentRecord) {
    if (downloadingId) return;
    setDownloadingId(document.id);
    const url = await getFileUrl(document);
    setDownloadingId(undefined);
    if (!url) {
      setNotice({
        tone: "error",
        title: `Couldn't download “${document.name}”`,
        message: MISSING_FILE_MESSAGE,
      });
      return;
    }
    const link = window.document.createElement("a");
    link.href = url;
    link.download = document.originalFileName;
    link.rel = "noopener";
    window.document.body.append(link);
    link.click();
    link.remove();
  }

  const actions: DocumentActions = {
    upload(preset) {
      clearNotice();
      setUpload((state) => ({ open: true, key: state.key + 1, preset }));
    },
    view: (document) => open(setPreview, document),
    download,
    replace(document) {
      setPreview((state) => ({ ...state, open: false }));
      open(setReplace, document);
    },
    remove: (document) => open(setRemove, document),
    downloadingId,
  };

  const dialogs = (
    <>
      <UploadDocumentDialog
        open={upload.open}
        onOpenChange={(isOpen) => setUpload((state) => ({ ...state, open: isOpen }))}
        formKey={upload.key}
        preset={upload.preset}
        onUploaded={(document) =>
          setNotice({
            tone: "success",
            title: "Document uploaded",
            message: `“${document.name}” has been added.`,
          })
        }
      />
      <DocumentPreviewDialog
        open={preview.open}
        onOpenChange={(isOpen) => setPreview((state) => ({ ...state, open: isOpen }))}
        document={preview.document}
        onDownload={download}
        onReplace={actions.replace}
        downloading={downloadingId !== undefined && downloadingId === preview.document?.id}
      />
      <ReplaceDocumentDialog
        open={replace.open}
        onOpenChange={(isOpen) => setReplace((state) => ({ ...state, open: isOpen }))}
        formKey={replace.key}
        document={replace.document}
        onReplaced={(document) =>
          setNotice({
            tone: "success",
            title: "File replaced",
            message: `“${document.name}” now uses ${document.originalFileName}.`,
          })
        }
      />
      <DeleteDocumentDialog
        open={remove.open}
        onOpenChange={(isOpen) => setRemove((state) => ({ ...state, open: isOpen }))}
        formKey={remove.key}
        document={remove.document}
        onDeleted={(document) =>
          setNotice({
            tone: "success",
            title: "Document deleted",
            message: `“${document.name}” and its file have been deleted.`,
          })
        }
      />
    </>
  );

  return { actions, dialogs };
}
