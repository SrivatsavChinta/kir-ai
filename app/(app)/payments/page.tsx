import type { Metadata } from "next";

import { RentPayments } from "@/components/payments/rent-payments";

export const metadata: Metadata = { title: "Rent & Payments" };

export default function PaymentsPage() {
  return <RentPayments />;
}
