import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findPaymentConflict, getObligationBalance, getObligationForMonth, getRentStatus } from "@/lib/rent-calculations";
import type { Payment } from "@/types/payment";
import type { RentObligation } from "@/types/rent-obligation";
import type { Tenancy } from "@/types/tenancy";

const tenancy: Tenancy = {
  id: "tenancy-1",
  tenantId: "tenant-1",
  unitId: "unit-1",
  monthlyRent: 25000,
  securityDeposit: 50000,
  rentDueDay: 5,
  moveInDate: "2026-09-01",
  agreementStartDate: "2026-09-01",
  agreementEndDate: "2027-08-31",
  status: "Active",
};

describe("rent rules", () => {
  it("bills a full month when the tenant holds the unit on the due date", () => {
    const bill = getObligationForMonth(tenancy, "2026-11", "2026-11-12");
    assert.ok(bill);
    assert.equal(bill?.expectedAmount, 25000);
    assert.equal(bill?.dueDate, "2026-11-05");
  });

  it("does not rewrite a paid month out of existence", () => {
    const obligation: RentObligation = {
      id: "bill-1",
      tenancyId: tenancy.id,
      billingMonth: "2026-09",
      dueDate: "2026-09-05",
      expectedAmount: 25000,
    };
    const payment: Payment = {
      id: "payment-1",
      tenancyId: tenancy.id,
      obligationId: obligation.id,
      amount: 25000,
      paymentDate: "2026-09-05",
      paymentMethod: "UPI",
    };
    const movedOut: Tenancy = { ...tenancy, status: "Ended", moveOutDate: "2026-08-31", endReason: "Moved out" };
    const conflict = findPaymentConflict([movedOut], [payment], [obligation], "2026-11-12", [tenancy.id]);
    assert.match(conflict ?? "", /already been recorded/);
  });

  it("keeps the outstanding balance and marks overdue the day after the due date", () => {
    const obligation: RentObligation = {
      id: "bill-2",
      tenancyId: tenancy.id,
      billingMonth: "2026-10",
      dueDate: "2026-10-05",
      expectedAmount: 25000,
    };
    const payment: Payment = {
      id: "payment-2",
      tenancyId: tenancy.id,
      obligationId: obligation.id,
      amount: 10000,
      paymentDate: "2026-10-05",
      paymentMethod: "UPI",
    };
    assert.equal(getObligationBalance(obligation.id, tenancy.id, [obligation], [payment]), 15000);
    assert.equal(getObligationBalance(obligation.id, "other-tenancy", [obligation], [payment]), null);
    assert.equal(getRentStatus(25000, 10000, "2026-10-05", "2026-10-05"), "Partially paid");
    assert.equal(getRentStatus(25000, 10000, "2026-10-05", "2026-10-06"), "Overdue");
    assert.equal(getRentStatus(25000, 25000, "2026-10-05", "2026-10-06"), "Paid");
  });
});
