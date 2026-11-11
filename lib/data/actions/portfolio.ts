"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dbError } from "@/lib/data/errors";
import {
  mapPayment,
  mapProperty,
  mapTenancy,
  mapTenant,
  mapUnit,
  type PaymentRow,
  type PropertyRow,
  type TenancyRow,
  type TenantRow,
  type UnitRow,
} from "@/lib/data/mappers";
import { syncRentObligations } from "@/lib/data/obligations";
import { readPortfolioSlice, requireSession } from "@/lib/data/workspace";
import { toCalendarDate } from "@/lib/dates";
import { fieldFailure, type MutationResult } from "@/lib/mutation";
import { formatINR } from "@/lib/format";
import { validatePropertyForm, validateUnitForm } from "@/lib/property-validation";
import { findPaymentConflict, getObligationBalance } from "@/lib/rent-calculations";
import { findTenant, getActiveTenancyForUnit, getCurrentTenancy } from "@/lib/tenants";
import { validateMoveOutDate, validateTenancyForm, validateTenantForm } from "@/lib/tenant-validation";
import type { Payment, PaymentInput } from "@/types/payment";
import type { Property, PropertyInput, RentalUnit, RentalUnitInput } from "@/types/property";
import type { RentObligation } from "@/types/rent-obligation";
import type { Tenancy, TenancyInput } from "@/types/tenancy";
import type { Tenant, TenantInput } from "@/types/tenant";

function todayStamp(): string {
  return toCalendarDate(new Date().toISOString());
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export async function createProperty(input: PropertyInput): Promise<MutationResult<Property>> {
  const checked = validatePropertyForm({ ...input, propertyType: input.propertyType });
  if (!checked.success) return fieldFailure(checked.errors);
  const session = await requireSession();
  if (!session.ok) return session;

  const { data, error } = await session.supabase
    .from("properties")
    .insert({
      landlord_id: session.userId,
      name: checked.data.name,
      property_type: checked.data.propertyType,
      address: checked.data.address,
      city: checked.data.city,
      state: checked.data.state,
      pincode: checked.data.pincode,
      description: checked.data.description,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, value: mapProperty(data as PropertyRow) };
}

export async function saveProperty(id: string, input: PropertyInput): Promise<MutationResult<Property>> {
  const checked = validatePropertyForm(input);
  if (!checked.success) return fieldFailure(checked.errors);
  const session = await requireSession();
  if (!session.ok) return session;

  const { data, error } = await session.supabase
    .from("properties")
    .update({
      name: checked.data.name,
      property_type: checked.data.propertyType,
      address: checked.data.address,
      city: checked.data.city,
      state: checked.data.state,
      pincode: checked.data.pincode,
      description: checked.data.description,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "That property no longer exists." };
  return { ok: true, value: mapProperty(data as PropertyRow) };
}

export async function createUnit(
  propertyId: string,
  input: RentalUnitInput,
): Promise<MutationResult<RentalUnit>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  const property = portfolio.properties.find((item) => item.id === propertyId);
  if (!property) return { ok: false, error: "That property no longer exists." };

  const checked = validateUnitForm(unitToForm(input), {
    siblingUnits: portfolio.units.filter((unit) => unit.propertyId === propertyId),
  });
  if (!checked.success) return fieldFailure(checked.errors);

  const { data, error } = await session.supabase
    .from("rental_units")
    .insert({
      landlord_id: session.userId,
      property_id: propertyId,
      ...unitColumns(checked.data),
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, value: mapUnit(data as UnitRow) };
}

export async function saveUnit(id: string, input: RentalUnitInput): Promise<MutationResult<RentalUnit>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  const existing = portfolio.units.find((unit) => unit.id === id);
  if (!existing) return { ok: false, error: "That rental unit no longer exists." };
  const active = getActiveTenancyForUnit(portfolio.tenancies, id);
  const activeTenantName = active
    ? findTenant(portfolio.tenants, active.tenantId)?.fullName
    : undefined;

  const checked = validateUnitForm(unitToForm(input), {
    siblingUnits: portfolio.units.filter((unit) => unit.propertyId === existing.propertyId),
    currentUnitId: id,
    activeTenantName,
  });
  if (!checked.success) return fieldFailure(checked.errors);

  const { data, error } = await session.supabase
    .from("rental_units")
    .update(unitColumns(checked.data))
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "That rental unit no longer exists." };
  return { ok: true, value: mapUnit(data as UnitRow) };
}

export async function createTenantWithTenancy(
  tenantInput: TenantInput,
  tenancyInput: TenancyInput,
): Promise<MutationResult<{ tenant: Tenant; tenancy: Tenancy; unit: RentalUnit; obligations: RentObligation[] }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  const today = todayStamp();

  const tenantChecked = validateTenantForm(tenantToForm(tenantInput), { tenants: portfolio.tenants });
  if (!tenantChecked.success) return fieldFailure(tenantChecked.errors);
  const tenancyChecked = checkTenancyInput(tenancyInput, {
    units: portfolio.units,
    tenancies: portfolio.tenancies,
    tenants: portfolio.tenants,
    today,
  });
  if (!tenancyChecked.ok) return tenancyChecked;

  const tenant = tenantChecked.data;
  const tenancy = tenancyChecked.value;
  const { data, error } = await session.supabase.rpc("create_tenant_with_tenancy", {
    p_full_name: tenant.fullName,
    p_phone: tenant.phone,
    p_email: tenant.email,
    p_current_address: blankToNull(tenant.currentAddress),
    p_emergency_name: tenant.emergencyContact?.name ?? null,
    p_emergency_phone: tenant.emergencyContact?.phone ?? null,
    p_unit_id: tenancy.unitId,
    p_monthly_rent: tenancy.monthlyRent,
    p_security_deposit: tenancy.securityDeposit,
    p_rent_due_day: tenancy.rentDueDay,
    p_move_in_date: tenancy.moveInDate,
    p_agreement_start_date: tenancy.agreementStartDate,
    p_agreement_end_date: tenancy.agreementEndDate,
  });
  if (error) return { ok: false, error: dbError(error) };

  const payload = data as { tenant: TenantRow; tenancy: TenancyRow };
  const savedTenancy = mapTenancy(payload.tenancy);
  const saved = await readPortfolioSlice(session.supabase);
  if (!saved.ok) return saved;
  const obligations = await syncRentObligations(
    session.supabase,
    session.userId,
    saved.tenancies,
    today,
    [savedTenancy.id],
  );
  if (!obligations.ok) {
    return { ok: false, error: "The tenant was saved, but this month's rent couldn't be prepared. Reload the page." };
  }
  const unit = saved.units.find((item) => item.id === savedTenancy.unitId);
  if (!unit) return { ok: false, error: "The tenancy was saved, but its unit couldn't be loaded. Reload the page." };
  return {
    ok: true,
    value: { tenant: mapTenant(payload.tenant), tenancy: savedTenancy, unit, obligations: obligations.value },
  };
}

export async function createTenant(input: TenantInput): Promise<MutationResult<Tenant>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  const checked = validateTenantForm(tenantToForm(input), { tenants: portfolio.tenants });
  if (!checked.success) return fieldFailure(checked.errors);

  const tenant = checked.data;
  const { data, error } = await session.supabase
    .from("tenants")
    .insert({
      landlord_id: session.userId,
      full_name: tenant.fullName,
      phone: tenant.phone,
      email: tenant.email,
      current_address: blankToNull(tenant.currentAddress),
      emergency_contact_name: tenant.emergencyContact?.name ?? null,
      emergency_contact_phone: tenant.emergencyContact?.phone ?? null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, value: mapTenant(data as TenantRow) };
}

export async function saveTenant(id: string, input: TenantInput): Promise<MutationResult<Tenant>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  if (!portfolio.tenants.some((tenant) => tenant.id === id)) {
    return { ok: false, error: "That tenant no longer exists." };
  }
  const checked = validateTenantForm(tenantToForm(input), {
    tenants: portfolio.tenants,
    currentTenantId: id,
  });
  if (!checked.success) return fieldFailure(checked.errors);

  const { data, error } = await session.supabase
    .from("tenants")
    .update({
      full_name: checked.data.fullName,
      phone: checked.data.phone,
      email: checked.data.email,
      current_address: blankToNull(checked.data.currentAddress),
      emergency_contact_name: checked.data.emergencyContact?.name ?? null,
      emergency_contact_phone: checked.data.emergencyContact?.phone ?? null,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "That tenant no longer exists." };
  return { ok: true, value: mapTenant(data as TenantRow) };
}

export async function beginTenancy(
  tenantId: string,
  input: TenancyInput,
): Promise<MutationResult<{ tenancy: Tenancy; unit: RentalUnit; obligations: RentObligation[] }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  if (!portfolio.tenants.some((tenant) => tenant.id === tenantId)) {
    return { ok: false, error: "That tenant no longer exists." };
  }
  if (getCurrentTenancy(portfolio.tenancies, tenantId)) {
    return { ok: false, error: "This tenant already has an active tenancy." };
  }
  const today = todayStamp();
  const checked = checkTenancyInput(input, {
    units: portfolio.units,
    tenancies: portfolio.tenancies,
    tenants: portfolio.tenants,
    today,
  });
  if (!checked.ok) return checked;

  const { data, error } = await session.supabase.rpc("start_tenancy", tenancyArgs(checked.value, { p_tenant_id: tenantId }));
  if (error) return { ok: false, error: dbError(error) };
  const tenancy = mapTenancy(data as TenancyRow);
  return finishTenancyWrite(session.supabase, session.userId, today, tenancy, [tenancy.id]);
}

export async function saveTenancy(
  tenancyId: string,
  input: TenancyInput,
): Promise<
  MutationResult<{
    tenancy: Tenancy;
    ended?: Tenancy;
    units: RentalUnit[];
    obligations: RentObligation[];
  }>
> {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  const existing = portfolio.tenancies.find((tenancy) => tenancy.id === tenancyId);
  if (!existing || existing.status !== "Active") {
    return { ok: false, error: "Only an active tenancy can be changed." };
  }
  const today = todayStamp();
  const checked = checkTenancyInput(input, {
    units: portfolio.units,
    tenancies: portfolio.tenancies,
    tenants: portfolio.tenants,
    today,
    currentTenancy: existing,
  });
  if (!checked.ok) return checked;

  if (input.unitId === existing.unitId) {
    const proposed = portfolio.tenancies.map((tenancy) =>
      tenancy.id === tenancyId ? { ...existing, ...checked.value, status: "Active" as const } : tenancy,
    );
    const conflict = findPaymentConflict(proposed, portfolio.payments, portfolio.obligations, today, [tenancyId]);
    if (conflict) return { ok: false, error: conflict };

    const { data, error } = await session.supabase
      .from("tenancies")
      .update({
        monthly_rent: checked.value.monthlyRent,
        security_deposit: checked.value.securityDeposit,
        rent_due_day: checked.value.rentDueDay,
        move_in_date: checked.value.moveInDate,
        agreement_start_date: checked.value.agreementStartDate,
        agreement_end_date: checked.value.agreementEndDate,
      })
      .eq("id", tenancyId)
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: dbError(error) };
    if (!data) return { ok: false, error: "Only an active tenancy can be changed." };
    const tenancy = mapTenancy(data as TenancyRow);
    const finished = await finishTenancyWrite(session.supabase, session.userId, today, tenancy, [tenancy.id]);
    if (!finished.ok) return finished;
    return { ok: true, value: { ...finished.value, units: [finished.value.unit] } };
  }

  const endedPreview: Tenancy = {
    ...existing,
    status: "Ended",
    moveOutDate: checked.value.moveInDate,
    endReason: "Moved to another unit",
  };
  const proposed = [
    ...portfolio.tenancies.map((tenancy) => (tenancy.id === tenancyId ? endedPreview : tenancy)),
    { ...checked.value, id: "pending", tenantId: existing.tenantId, status: "Active" as const },
  ];
  const conflict = findPaymentConflict(proposed, portfolio.payments, portfolio.obligations, today, [tenancyId]);
  if (conflict) return { ok: false, error: conflict };

  const { data, error } = await session.supabase.rpc("move_tenancy", {
    p_tenancy_id: tenancyId,
    ...tenancyArgs(checked.value),
  });
  if (error) return { ok: false, error: dbError(error) };
  const payload = data as { ended: TenancyRow; tenancy: TenancyRow };
  const tenancy = mapTenancy(payload.tenancy);
  const ended = mapTenancy(payload.ended);
  const finished = await finishTenancyWrite(
    session.supabase,
    session.userId,
    today,
    tenancy,
    [tenancyId, tenancy.id],
    [ended.unitId],
  );
  if (!finished.ok) return finished;
  return {
    ok: true,
    value: {
      tenancy: finished.value.tenancy,
      ended,
      units: finished.value.units,
      obligations: finished.value.obligations,
    },
  };
}

export async function closeTenancy(
  tenancyId: string,
  moveOutDate: string,
): Promise<MutationResult<{ tenancy: Tenancy; unit: RentalUnit; obligations: RentObligation[] }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  const existing = portfolio.tenancies.find((tenancy) => tenancy.id === tenancyId);
  if (!existing || existing.status !== "Active") {
    return { ok: false, error: "This tenancy has already ended." };
  }
  const today = todayStamp();
  const dated = validateMoveOutDate(moveOutDate, existing, today);
  if (!dated.success) return { ok: false, error: dated.error };

  const proposed = portfolio.tenancies.map((tenancy) =>
    tenancy.id === tenancyId
      ? { ...existing, status: "Ended" as const, moveOutDate: dated.data, endReason: "Moved out" as const }
      : tenancy,
  );
  const conflict = findPaymentConflict(proposed, portfolio.payments, portfolio.obligations, today, [tenancyId]);
  if (conflict) return { ok: false, error: conflict };

  const { data, error } = await session.supabase.rpc("end_tenancy", {
    p_tenancy_id: tenancyId,
    p_move_out_date: dated.data,
  });
  if (error) return { ok: false, error: dbError(error) };
  return finishTenancyWrite(session.supabase, session.userId, today, mapTenancy(data as TenancyRow), [tenancyId]);
}

export async function recordRentPayment(input: PaymentInput): Promise<MutationResult<Payment>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  if (!portfolio.tenancies.some((tenancy) => tenancy.id === input.tenancyId)) {
    return { ok: false, error: "That tenancy no longer exists." };
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Payment amount must be more than ₹0." };
  }
  if (!input.obligationId) return { ok: false, error: "Choose the rent this payment is for." };

  const balance = getObligationBalance(
    input.obligationId,
    input.tenancyId,
    portfolio.obligations,
    portfolio.payments,
  );
  if (balance === null) return { ok: false, error: "That rent isn't billed to this tenancy." };
  if (balance === 0) return { ok: false, error: "That rent has already been paid in full." };
  if (input.amount > balance) {
    return { ok: false, error: `Only ${formatINR(balance)} is outstanding for that month.` };
  }

  const { data, error } = await session.supabase.rpc("record_payment", {
    p_tenancy_id: input.tenancyId,
    p_obligation_id: input.obligationId,
    p_amount: input.amount,
    p_payment_date: input.paymentDate,
    p_payment_method: input.paymentMethod,
    p_transaction_reference: input.transactionReference ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) {
    if (error.message.includes("exceed the rent due")) {
      return { ok: false, error: `Only ${formatINR(balance)} is outstanding for that month.` };
    }
    return { ok: false, error: dbError(error) };
  }
  return { ok: true, value: mapPayment(data as PaymentRow) };
}

function unitToForm(input: RentalUnitInput) {
  return {
    unitNumber: input.unitNumber,
    floor: input.floor === undefined ? "" : String(input.floor),
    bedrooms: input.bedrooms === undefined ? "" : String(input.bedrooms),
    bathrooms: input.bathrooms === undefined ? "" : String(input.bathrooms),
    monthlyRent: String(input.monthlyRent),
    securityDeposit: input.securityDeposit === undefined ? "" : String(input.securityDeposit),
    status: input.status,
  };
}

function unitColumns(input: RentalUnitInput) {
  return {
    unit_number: input.unitNumber,
    floor: input.floor ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    monthly_rent: input.monthlyRent,
    security_deposit: input.securityDeposit ?? null,
    status: input.status,
  };
}

function tenantToForm(input: TenantInput) {
  return {
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    currentAddress: input.currentAddress ?? "",
    emergencyContactName: input.emergencyContact?.name ?? "",
    emergencyContactPhone: input.emergencyContact?.phone ?? "",
  };
}

function checkTenancyInput(
  input: TenancyInput,
  context: Parameters<typeof validateTenancyForm>[1],
): MutationResult<TenancyInput> {
  const unit = context.units.find((item) => item.id === input.unitId);
  const result = validateTenancyForm(
    {
      propertyId: unit?.propertyId ?? "",
      unitId: input.unitId,
      monthlyRent: String(input.monthlyRent),
      securityDeposit: String(input.securityDeposit),
      rentDueDay: String(input.rentDueDay),
      moveInDate: input.moveInDate,
      agreementStartDate: input.agreementStartDate,
      agreementEndDate: input.agreementEndDate,
    },
    context,
  );
  if (!result.success) return fieldFailure(result.errors);
  return { ok: true, value: result.data };
}

function tenancyArgs(input: TenancyInput, extra?: { p_tenant_id: string }) {
  return {
    ...extra,
    p_unit_id: input.unitId,
    p_monthly_rent: input.monthlyRent,
    p_security_deposit: input.securityDeposit,
    p_rent_due_day: input.rentDueDay,
    p_move_in_date: input.moveInDate,
    p_agreement_start_date: input.agreementStartDate,
    p_agreement_end_date: input.agreementEndDate,
  };
}

async function finishTenancyWrite(
  supabase: SupabaseClient,
  landlordId: string,
  today: string,
  tenancy: Tenancy,
  reconcileIds: string[],
  extraUnitIds: string[] = [],
): Promise<MutationResult<{ tenancy: Tenancy; unit: RentalUnit; units: RentalUnit[]; obligations: RentObligation[] }>> {
  const saved = await readPortfolioSlice(supabase);
  if (!saved.ok) return saved;
  const obligations = await syncRentObligations(supabase, landlordId, saved.tenancies, today, reconcileIds);
  if (!obligations.ok) {
    return { ok: false, error: "The tenancy was saved, but rent for those dates couldn't be updated. Reload the page." };
  }
  const unit = saved.units.find((item) => item.id === tenancy.unitId);
  if (!unit) return { ok: false, error: "The tenancy was saved, but its unit couldn't be loaded. Reload the page." };
  const unitIds = new Set([tenancy.unitId, ...extraUnitIds]);
  const fresh = saved.tenancies.find((item) => item.id === tenancy.id) ?? tenancy;
  return {
    ok: true,
    value: {
      tenancy: fresh,
      unit,
      units: saved.units.filter((item) => unitIds.has(item.id)),
      obligations: obligations.value,
    },
  };
}
