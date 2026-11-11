import { Badge } from "@/components/ui/badge";
import type { RentStatus } from "@/types/rent-obligation";

export function PaymentStatusBadge({ status }: { status: RentStatus }) {
  switch (status) {
    case "Paid":
      return (
        <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-300">
          Paid
        </Badge>
      );
    case "Partially paid":
      return (
        <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300">
          Partially paid
        </Badge>
      );
    case "Overdue":
      return <Badge variant="destructive">Overdue</Badge>;
    case "Pending":
      return <Badge variant="outline">Pending</Badge>;
  }
}
