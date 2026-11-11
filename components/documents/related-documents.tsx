"use client";

import Link from "next/link";
import { cn } from "cn";
import { Files, Upload } from "lucide-react";

import { DocumentCard } from "@/components/documents/document-list-item";
import { useDocuments } from "@/components/documents/documents-provider";
import { useDocumentActions } from "@/components/documents/use-document-actions";
import { InlineEmptyState } from "@/components/feedback/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDocumentForProperty, isDocumentForTenant } from "@/lib/documents";
import { pluralize } from "@/lib/format";

type RelatedDocumentsProps = {
  /** Documents of this record, plus those of its tenancies. */
  owner: { type: "property" | "tenant"; id: string };
  /** Lay cards out in two columns on wider screens. */
  wide?: boolean;
};

/** A profile's documents, with uploads linked to the profile by default. */
export function RelatedDocuments({ owner, wide = false }: RelatedDocumentsProps) {
  const { rows } = useDocuments();
  const { actions, dialogs } = useDocumentActions();
  const related = rows.filter(({ association }) =>
    owner.type === "property"
      ? isDocumentForProperty(association, owner.id)
      : isDocumentForTenant(association, owner.id),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Documents
        </CardTitle>
        <CardDescription>
          {owner.type === "property"
            ? "Property paperwork and documents for tenancies here"
            : "ID proofs and documents for their tenancies"}
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            onClick={() =>
              actions.upload({ associationType: owner.type, associatedRecordId: owner.id })
            }
          >
            <Upload data-icon="inline-start" />
            Upload
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {related.length === 0 ? (
          <InlineEmptyState icon={Files}>
            No documents yet.{" "}
            {owner.type === "property"
              ? "Upload tax receipts, certificates or bills for this property."
              : "Upload an agreement or ID proof for this tenant."}
          </InlineEmptyState>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {pluralize(related.length, "document")}, most recent first
            </p>
            <ul className={cn("grid grid-cols-1 gap-3", wide && "md:grid-cols-2")}>
              {related.map((row) => (
                <li key={row.document.id}>
                  <DocumentCard row={row} actions={actions} />
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/documents" className={buttonVariants({ variant: "link", className: "px-0" })}>
          Open Documents
        </Link>
      </CardContent>
      {dialogs}
    </Card>
  );
}
