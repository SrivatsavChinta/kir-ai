import Link from "next/link";
import { Download, Eye, Link2, RefreshCw, Trash2 } from "lucide-react";

import { DocumentCategoryBadge } from "@/components/documents/document-category-badge";
import type { DocumentRow } from "@/components/documents/documents-provider";
import type { DocumentActions } from "@/components/documents/use-document-actions";
import { Spinner } from "@/components/feedback/spinner";
import { useFormatters } from "@/components/settings/settings-provider";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { toCalendarDate } from "@/lib/dates";
import {
  ASSOCIATION_TYPE_LABELS,
  describeAssociation,
  getFileTypeLabel,
} from "@/lib/documents";
import { formatFileSize } from "@/lib/format";

type DocumentItemProps = { row: DocumentRow; actions: DocumentActions };

function fileSummary({ document }: DocumentRow): string {
  return `${getFileTypeLabel(document.mimeType)} · ${formatFileSize(document.fileSize)}`;
}

function UploadedOn({ document }: DocumentRow) {
  const { formatDate, formatDateTime } = useFormatters();
  return (
    <time dateTime={document.uploadedAt} title={formatDateTime(document.uploadedAt)}>
      {formatDate(toCalendarDate(document.uploadedAt))}
    </time>
  );
}

function RowActions({ row, actions, compact }: DocumentItemProps & { compact: boolean }) {
  const { document } = row;
  const downloading = actions.downloadingId === document.id;
  const downloadIcon = downloading ? (
    <Spinner />
  ) : (
    <Download data-icon="inline-start" />
  );
  const iconActions = (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => actions.replace(document)}
        aria-label={`Replace file for ${document.name}`}
        title="Replace file"
      >
        <RefreshCw />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => actions.remove(document)}
        aria-label={`Delete ${document.name}`}
        title="Delete"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </>
  );

  if (compact) {
    return (
      <div className="flex justify-end gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => actions.view(document)}
          aria-label={`View ${document.name}`}
          title="View"
        >
          <Eye />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => actions.download(document)}
          disabled={downloading}
          aria-label={`Download ${document.name}`}
          title="Download"
        >
          {downloadIcon}
        </Button>
        {iconActions}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => actions.view(document)} aria-label={`View ${document.name}`}>
        <Eye data-icon="inline-start" />
        View
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => actions.download(document)}
        disabled={downloading}
        aria-label={`Download ${document.name}`}
      >
        {downloadIcon}
        Download
      </Button>
      <div className="ml-auto flex gap-1">{iconActions}</div>
    </div>
  );
}

export function DocumentTableRow({ row, actions }: DocumentItemProps) {
  const { document, association } = row;
  return (
    <TableRow>
      <TableCell className="max-w-64 pl-4 whitespace-normal">
        <span className="block font-medium break-words">{document.name}</span>
        {document.description && (
          <span className="line-clamp-1 text-xs text-muted-foreground" title={document.description}>
            {document.description}
          </span>
        )}
      </TableCell>
      <TableCell>
        <DocumentCategoryBadge category={document.category} />
      </TableCell>
      <TableCell className="max-w-48 whitespace-normal">
        {association.property ? (
          <>
            <Link
              href={`/properties/${association.property.id}`}
              className="block break-words underline-offset-4 hover:underline"
            >
              {association.property.name}
            </Link>
            {association.unit && (
              <span className="block text-xs text-muted-foreground">
                Unit {association.unit.unitNumber}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-40 whitespace-normal">
        {association.tenant ? (
          <>
            <Link
              href={`/tenants/${association.tenant.id}`}
              className="block break-words underline-offset-4 hover:underline"
            >
              {association.tenant.fullName}
            </Link>
            {association.type === "tenancy" && (
              <span className="block text-xs text-muted-foreground">
                {association.tenancy?.status === "Ended" ? "Ended tenancy" : "Tenancy"}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {!association.found && (
          <span className="block text-xs text-destructive">
            Linked {ASSOCIATION_TYPE_LABELS[association.type].toLowerCase()} no longer exists
          </span>
        )}
      </TableCell>
      <TableCell>
        <UploadedOn {...row} />
      </TableCell>
      <TableCell className="text-muted-foreground">{fileSummary(row)}</TableCell>
      <TableCell className="pr-4">
        <RowActions row={row} actions={actions} compact />
      </TableCell>
    </TableRow>
  );
}

/** A document as a card, for small screens and profile pages. */
export function DocumentCard({ row, actions }: DocumentItemProps) {
  const { document, association } = row;
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
      <div className="space-y-1.5">
        <h3 className="font-medium break-words">{document.name}</h3>
        <DocumentCategoryBadge category={document.category} />
      </div>

      <p className="flex items-start gap-1.5 text-muted-foreground">
        <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">
          <span className="sr-only">Linked to </span>
          {ASSOCIATION_TYPE_LABELS[association.type]}: {describeAssociation(association)}
        </span>
      </p>

      {document.description && (
        <p className="line-clamp-2 break-words text-muted-foreground">{document.description}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Uploaded <UploadedOn {...row} /> · {fileSummary(row)}
      </p>

      <div className="mt-auto border-t pt-3">
        <RowActions row={row} actions={actions} compact={false} />
      </div>
    </article>
  );
}
