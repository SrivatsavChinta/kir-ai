import type { Metadata } from "next";

import { DocumentManagement } from "@/components/documents/document-management";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return <DocumentManagement />;
}
