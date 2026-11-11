import { isCalendarDate } from "@/lib/dates";
import { formatDate, formatINR } from "@/lib/format";
import { findTenant, getActiveTenancyForUnit } from "@/lib/tenants";
import {
  EMAIL_HINT,
  hasErrors,
  isValidEmail,
  MAX_MONTHLY_RENT,
  MAX_SECURITY_DEPOSIT,
  normalizeIndianMobile,
  parseWholeNumber,
  PHONE_HINT,
  type FieldErrors,
  type ValidationResult,
} from "@/lib/validation";
import type { RentalUnit } from "@/types/property";
import type { Tenancy, TenancyInput } from "@/types/tenancy";
import type { Tenant, TenantInput } from "@/types/tenant";

// Tenant

export type TenantFormValues = {
  fullName: string;
  phone: string;
  email: string;
  currentAddress: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export function tenantToFormValues(tenant?: Tenant): TenantFormValues {
  return {
    fullName: tenant?.fullName ?? "",
    phone: tenant?.phone ?? "",
    email: tenant?.email ?? "",
    currentAddress: tenant?.currentAddress ?? "",
    emergencyContactName: tenant?.emergencyContact?.name ?? "",
    emergencyContactPhone: tenant?.emergencyContact?.phone ?? "",
  };
}

export type TenantValidationContext = {
  tenants: Tenant[];
  /** The tenant being edited, excluded from the duplicate checks. */
  currentTenantId?: string;
};

export function validateTenantForm(
  values: TenantFormValues,
  { tenants, currentTenantId }: TenantValidationContext,
): ValidationResult<TenantInput, TenantFormValues> {
  const errors: FieldErrors<TenantFormValues> = {};
  const others = tenants.filter((tenant) => tenant.id !== currentTenantId);

  const fullName = values.fullName.trim().replace(/\s+/g, " ");
  if (!fullName) errors.fullName = "Enter the tenant's full name.";
  else if (fullName.length < 2) errors.fullName = "Name must be at least 2 characters.";
  else if (fullName.length > 80) errors.fullName = "Name must be 80 characters or fewer.";
  else if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(fullName)) {
    errors.fullName = "Name can only contain letters, spaces, hyphens, full stops and apostrophes.";
  }

  const phone = normalizeIndianMobile(values.phone);
  if (!values.phone.trim()) errors.phone = "Enter a phone number.";
  else if (!phone) errors.phone = PHONE_HINT;
  else {
    const existing = others.find((tenant) => tenant.phone === phone);
    if (existing) {
      errors.phone = `${existing.fullName} already has this phone number. Open their profile instead of adding them again.`;
    }
  }

  const email = values.email.trim().toLowerCase();
  if (!email) errors.email = "Enter an email address.";
  else if (email.length > 120) errors.email = "Email must be 120 characters or fewer.";
  else if (!isValidEmail(email)) {
    errors.email = EMAIL_HINT;
  } else {
    const existing = others.find((tenant) => tenant.email.toLowerCase() === email);
    if (existing) errors.email = `${existing.fullName} already has this email address.`;
  }

  const currentAddress = values.currentAddress.trim();
  if (currentAddress.length > 200) {
    errors.currentAddress = "Address must be 200 characters or fewer.";
  }

  const contactName = values.emergencyContactName.trim().replace(/\s+/g, " ");
  const contactPhoneRaw = values.emergencyContactPhone.trim();
  const contactPhone = normalizeIndianMobile(contactPhoneRaw);
  if (contactName || contactPhoneRaw) {
    if (!contactName) errors.emergencyContactName = "Enter the emergency contact's name.";
    else if (contactName.length > 80) {
      errors.emergencyContactName = "Name must be 80 characters or fewer.";
    }

    if (!contactPhoneRaw) errors.emergencyContactPhone = "Enter the emergency contact's phone number.";
    else if (!contactPhone) errors.emergencyContactPhone = PHONE_HINT;
    else if (phone && contactPhone === phone) {
      errors.emergencyContactPhone = "Use a different number from the tenant's own phone.";
    }
  }

  if (hasErrors(errors) || !phone) return { success: false, errors };

  return {
    success: true,
    data: {
      fullName,
      phone,
      email,
      currentAddress: currentAddress || undefined,
      emergencyContact:
        contactName && contactPhone ? { name: contactName, phone: contactPhone } : undefined,
    },
  };
}

// Tenancy

export type TenancyFormValues = {
  propertyId: string;
  unitId: string;
  monthlyRent: string;
  securityDeposit: string;
  rentDueDay: string;
  moveInDate: string;
  agreementStartDate: string;
  agreementEndDate: string;
};

export function tenancyToFormValues(
  tenancy?: Tenancy,
  unit?: RentalUnit,
): TenancyFormValues {
  return {
    propertyId: unit?.propertyId ?? "",
    unitId: tenancy?.unitId ?? "",
    monthlyRent: tenancy?.monthlyRent.toString() ?? "",
    securityDeposit: tenancy?.securityDeposit.toString() ?? "",
    rentDueDay: tenancy?.rentDueDay.toString() ?? "5",
    moveInDate: tenancy?.moveInDate ?? "",
    agreementStartDate: tenancy?.agreementStartDate ?? "",
    agreementEndDate: tenancy?.agreementEndDate ?? "",
  };
}

export type UnitAvailability =
  | { available: true }
  | { available: false; reason: "let"; tenantName: string }
  | { available: false; reason: "marked-occupied" };

/**
 * Whether a unit can take a new tenancy. A unit must be vacant and free of any
 * active tenancy; `currentTenancy`'s own unit always counts as available.
 */
export function getUnitAvailability(
  unit: RentalUnit,
  context: { tenancies: Tenancy[]; tenants: Tenant[]; currentTenancy?: Tenancy },
): UnitAvailability {
  if (context.currentTenancy?.unitId === unit.id) return { available: true };

  const active = getActiveTenancyForUnit(context.tenancies, unit.id);
  if (active) {
    const tenantName =
      findTenant(context.tenants, active.tenantId)?.fullName ?? "another tenant";
    return { available: false, reason: "let", tenantName };
  }
  if (unit.status !== "Vacant") {
    return { available: false, reason: "marked-occupied" };
  }
  return { available: true };
}

export type TenancyValidationContext = {
  units: RentalUnit[];
  tenancies: Tenancy[];
  tenants: Tenant[];
  /** Today's date (YYYY-MM-DD); move-out dates can't be later. */
  today: string;
  /** The active tenancy being edited. Choosing a different unit moves the tenant. */
  currentTenancy?: Tenancy;
};

function validateDate(
  raw: string,
  emptyMessage: string,
): { value: string; error?: undefined } | { value?: undefined; error: string } {
  if (!raw) return { error: emptyMessage };
  if (!isCalendarDate(raw)) return { error: "Enter a valid date." };
  return { value: raw };
}

export function validateTenancyForm(
  values: TenancyFormValues,
  context: TenancyValidationContext,
): ValidationResult<TenancyInput, TenancyFormValues> {
  const errors: FieldErrors<TenancyFormValues> = {};
  const { units, today, currentTenancy } = context;

  if (!values.propertyId) errors.propertyId = "Select a property.";

  const unit = units.find((candidate) => candidate.id === values.unitId);
  if (!values.unitId) errors.unitId = "Select a rental unit.";
  else if (!unit || unit.propertyId !== values.propertyId) {
    errors.unitId = "Select a rental unit in the chosen property.";
  } else {
    const availability = getUnitAvailability(unit, context);
    if (!availability.available) {
      errors.unitId =
        availability.reason === "let"
          ? `Unit ${unit.unitNumber} already has an active tenancy (${availability.tenantName}). End that tenancy first.`
          : `Unit ${unit.unitNumber} is marked occupied. Only vacant units can take a new tenancy.`;
    }
  }

  let monthlyRent = 0;
  const rent = parseWholeNumber(values.monthlyRent);
  if (!values.monthlyRent.trim()) errors.monthlyRent = "Enter the agreed monthly rent.";
  else if (rent === null) errors.monthlyRent = "Enter the rent as a whole number of rupees.";
  else if (rent <= 0) errors.monthlyRent = "Monthly rent must be more than ₹0.";
  else if (rent > MAX_MONTHLY_RENT) {
    errors.monthlyRent = `Monthly rent must be ${formatINR(MAX_MONTHLY_RENT)} or less.`;
  } else monthlyRent = rent;

  let securityDeposit = 0;
  const deposit = parseWholeNumber(values.securityDeposit);
  if (!values.securityDeposit.trim()) {
    errors.securityDeposit = "Enter the security deposit, or 0 if none was taken.";
  } else if (deposit === null || deposit < 0 || deposit > MAX_SECURITY_DEPOSIT) {
    errors.securityDeposit = `Enter the deposit as a whole number of rupees, up to ${formatINR(MAX_SECURITY_DEPOSIT)}.`;
  } else securityDeposit = deposit;

  let rentDueDay = 0;
  const dueDay = parseWholeNumber(values.rentDueDay);
  if (dueDay === null || dueDay < 1 || dueDay > 28) {
    errors.rentDueDay = "Enter a day of the month from 1 to 28.";
  } else rentDueDay = dueDay;

  const start = validateDate(values.agreementStartDate, "Enter the agreement start date.");
  const end = validateDate(values.agreementEndDate, "Enter the agreement end date.");
  const moveIn = validateDate(values.moveInDate, "Enter the move-in date.");
  if (start.error) errors.agreementStartDate = start.error;
  if (end.error) errors.agreementEndDate = end.error;
  if (moveIn.error) errors.moveInDate = moveIn.error;

  if (start.value && end.value && end.value <= start.value) {
    errors.agreementEndDate = "Agreement end date must be after the start date.";
  }
  if (moveIn.value && end.value && !errors.agreementEndDate && moveIn.value >= end.value) {
    errors.moveInDate = "Move-in date must be before the agreement end date.";
  }

  const isMove = currentTenancy !== undefined && values.unitId !== currentTenancy.unitId;
  if (isMove && moveIn.value && !errors.moveInDate) {
    if (moveIn.value <= currentTenancy.moveInDate) {
      errors.moveInDate = `The move must be after the current move-in date (${formatDate(currentTenancy.moveInDate)}).`;
    } else if (moveIn.value > today) {
      errors.moveInDate = `Record the move once it has happened. The date can't be after ${formatDate(today)}.`;
    }
  }

  if (hasErrors(errors) || !start.value || !end.value || !moveIn.value) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      unitId: values.unitId,
      monthlyRent,
      securityDeposit,
      rentDueDay,
      moveInDate: moveIn.value,
      agreementStartDate: start.value,
      agreementEndDate: end.value,
    },
  };
}

// Ending a tenancy

export function validateMoveOutDate(
  raw: string,
  tenancy: Tenancy,
  today: string,
): { success: true; data: string } | { success: false; error: string } {
  const date = validateDate(raw, "Enter the move-out date.");
  if (date.error !== undefined) return { success: false, error: date.error };
  if (date.value < tenancy.moveInDate) {
    return {
      success: false,
      error: `Move-out date can't be before the move-in date (${formatDate(tenancy.moveInDate)}).`,
    };
  }
  // A tenancy that hasn't started yet may be cancelled on its move-in date.
  const latest = tenancy.moveInDate > today ? tenancy.moveInDate : today;
  if (date.value > latest) {
    return {
      success: false,
      error: `Record the end once the tenant has moved out. The date can't be after ${formatDate(latest)}.`,
    };
  }
  return { success: true, data: date.value };
}
