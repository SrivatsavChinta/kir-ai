import type { Payment } from "@/types/payment";
import type { Property, RentalUnit } from "@/types/property";
import type { RentObligation } from "@/types/rent-obligation";
import type { Tenancy } from "@/types/tenancy";
import type { Tenant } from "@/types/tenant";

/** Landlord portfolio loaded from Supabase. The database is the source of truth. */
export type PortfolioSnapshot = {
  asOf: string;
  today: string;
  properties: Property[];
  units: RentalUnit[];
  tenants: Tenant[];
  tenancies: Tenancy[];
  payments: Payment[];
  obligations: RentObligation[];
};
