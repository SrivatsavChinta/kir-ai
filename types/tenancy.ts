// Dates are calendar dates (YYYY-MM-DD) in IST.

export type TenancyStatus = "Active" | "Ended";

export type TenancyEndReason = "Moved out" | "Moved to another unit";

/**
 * One tenant's occupation of one rental unit over a period. Ended tenancies are
 * kept as history and never edited; a move to another unit ends the current
 * tenancy and starts a new one.
 */
export type Tenancy = {
  id: string;
  tenantId: string;
  unitId: string;
  /** Agreed rent, which may differ from the unit's listed rent. */
  monthlyRent: number;
  securityDeposit: number;
  /** Day of the month rent falls due, 1–28. */
  rentDueDay: number;
  moveInDate: string;
  agreementStartDate: string;
  agreementEndDate: string;
  status: TenancyStatus;
  /** Set when the tenancy ends. */
  moveOutDate?: string;
  endReason?: TenancyEndReason;
};

/** Terms that can be set when a tenancy starts or corrected while it is active. */
export type TenancyTerms = Pick<
  Tenancy,
  | "monthlyRent"
  | "securityDeposit"
  | "rentDueDay"
  | "moveInDate"
  | "agreementStartDate"
  | "agreementEndDate"
>;

export type TenancyInput = TenancyTerms & { unitId: string };
