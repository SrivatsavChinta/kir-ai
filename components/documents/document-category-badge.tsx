import {
  Building2,
  File,
  FileSignature,
  IdCard,
  Receipt,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DocumentCategory } from "@/types/document";

export const CATEGORY_ICONS: Record<DocumentCategory, LucideIcon> = {
  "Rental Agreement": FileSignature,
  "Tenant ID": IdCard,
  "Property Document": Building2,
  "Invoice / Bill": Receipt,
  "Maintenance Document": Wrench,
  Other: File,
};

export function DocumentCategoryBadge({ category }: { category: DocumentCategory }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <Badge variant="secondary">
      <Icon data-icon="inline-start" aria-hidden />
      {category}
    </Badge>
  );
}
