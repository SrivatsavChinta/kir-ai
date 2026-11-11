"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileX, RefreshCw } from "lucide-react";

import { useDocuments } from "@/components/documents/documents-provider";
import { LoadingState, Spinner } from "@/components/feedback/spinner";
import { useFormatters } from "@/components/settings/settings-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFileTypeLabel, isPreviewableImage } from "@/lib/documents";
import { formatFileSize } from "@/lib/format";
import type { DocumentRecord } from "@/types/document";

type DocumentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentRecord | null;
  onDownload: (document: DocumentRecord) => void;
  onReplace: (document: DocumentRecord) => void;
  downloading: boolean;
};

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
  ...actions
}: DocumentPreviewDialogProps) {
  const { formatDateTime } = useFormatters();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        {document && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="leading-snug break-words">{document.name}</DialogTitle>
              <DialogDescription className="break-all">
                {document.originalFileName} · {getFileTypeLabel(document.mimeType)} ·{" "}
                {formatFileSize(document.fileSize)} · uploaded {formatDateTime(document.uploadedAt)}
              </DialogDescription>
            </DialogHeader>
            <PreviewBody
              key={`${document.id}:${document.storagePath}`}
              document={document}
              {...actions}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type PreviewState = { status: "loading" } | { status: "ready"; url: string } | { status: "missing" };

function PreviewBody({
  document,
  onDownload,
  onReplace,
  downloading,
}: Omit<DocumentPreviewDialogProps, "open" | "onOpenChange" | "document"> & {
  document: DocumentRecord;
}) {
  const { getFileUrl } = useDocuments();
  const [state, setState] = useState<PreviewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getFileUrl(document).then((url) => {
      if (!cancelled) setState(url ? { status: "ready", url } : { status: "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, [getFileUrl, document]);

  return (
    <>
      <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
        {state.status === "loading" && (
          <LoadingState label="Loading preview…" />
        )}
        {state.status === "missing" && (
          <div className="flex max-w-sm flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
            <FileX className="size-6 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">File not available</p>
              <p className="text-sm text-muted-foreground">
                The file for this document couldn&apos;t be found. Replace the file to restore it;
                the document&apos;s details are kept.
              </p>
            </div>
            <Button variant="outline" onClick={() => onReplace(document)}>
              <RefreshCw data-icon="inline-start" />
              Replace file
            </Button>
          </div>
        )}
        {state.status === "ready" &&
          (isPreviewableImage(document.mimeType) ? (
            // Uploaded files are blob: URLs, which next/image can't optimise.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.url}
              alt={`Preview of ${document.name}`}
              className="max-h-[65dvh] w-auto max-w-full object-contain"
            />
          ) : (
            <iframe
              src={state.url}
              title={`Preview of ${document.name}`}
              className="h-[65dvh] w-full bg-background"
            />
          ))}
      </div>

      <DialogFooter>
        {state.status === "ready" && (
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink data-icon="inline-start" />
            Open in new tab
          </a>
        )}
        <Button
          onClick={() => onDownload(document)}
          disabled={downloading || state.status !== "ready"}
        >
          {downloading ? (
            <Spinner />
          ) : (
            <Download data-icon="inline-start" />
          )}
          Download
        </Button>
      </DialogFooter>
    </>
  );
}
