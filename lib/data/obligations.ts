import type { SupabaseClient } from "@supabase/supabase-js";

import { dbError } from "@/lib/data/errors";
import { mapObligation, type ObligationRow } from "@/lib/data/mappers";
import type { MutationResult } from "@/lib/mutation";
import { generateRentObligations, getObligationForMonth } from "@/lib/rent-calculations";
import type { RentObligation } from "@/types/rent-obligation";
import type { Tenancy } from "@/types/tenancy";

/**
 * Rent bills are stored once per tenancy and billing month.
 *
 * A missing month is inserted from the tenancy's current agreed rent. An
 * existing row is not updated when that rent later changes, so payments stay
 * measured against the amount that was billed. Months that the tenancy no
 * longer covers are removed only when nothing has been paid against them.
 * The unique key (tenancy_id, billing_month) stops a second insert of the
 * same bill when the dashboard and the payments page both load.
 */
export async function syncRentObligations(
  supabase: SupabaseClient,
  landlordId: string,
  tenancies: Tenancy[],
  today: string,
  reconcileTenancyIds: string[] = [],
): Promise<MutationResult<RentObligation[]>> {
  const { data, error } = await supabase
    .from("rent_obligations")
    .select("id, tenancy_id, billing_month, due_date, expected_amount")
    .eq("landlord_id", landlordId);

  if (error) return { ok: false, error: dbError(error) };
  let existing = (data ?? []) as ObligationRow[];

  const tenancyById = new Map(tenancies.map((tenancy) => [tenancy.id, tenancy]));
  for (const tenancyId of reconcileTenancyIds) {
    const tenancy = tenancyById.get(tenancyId);
    if (!tenancy) continue;
    for (const row of existing.filter((candidate) => candidate.tenancy_id === tenancyId)) {
      if (getObligationForMonth(tenancy, row.billing_month, today)) continue;
      const { count, error: countError } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("obligation_id", row.id);
      if (countError) return { ok: false, error: dbError(countError) };
      if ((count ?? 0) > 0) continue;
      const { error: deleteError } = await supabase.from("rent_obligations").delete().eq("id", row.id);
      if (deleteError) return { ok: false, error: dbError(deleteError) };
      existing = existing.filter((candidate) => candidate.id !== row.id);
    }
  }

  const present = new Set(existing.map((row) => `${row.tenancy_id}|${row.billing_month}`));
  const missing = generateRentObligations(tenancies, today).filter(
    (obligation) => !present.has(`${obligation.tenancyId}|${obligation.billingMonth}`),
  );

  for (const obligation of missing) {
    const { error: insertError } = await supabase.from("rent_obligations").insert({
      landlord_id: landlordId,
      tenancy_id: obligation.tenancyId,
      billing_month: obligation.billingMonth,
      due_date: obligation.dueDate,
      expected_amount: obligation.expectedAmount,
    });
    if (insertError && insertError.code !== "23505") {
      return { ok: false, error: dbError(insertError) };
    }
  }

  const reloaded = await supabase
    .from("rent_obligations")
    .select("id, tenancy_id, billing_month, due_date, expected_amount")
    .eq("landlord_id", landlordId);
  if (reloaded.error) return { ok: false, error: dbError(reloaded.error) };
  return { ok: true, value: ((reloaded.data ?? []) as ObligationRow[]).map(mapObligation) };
}
