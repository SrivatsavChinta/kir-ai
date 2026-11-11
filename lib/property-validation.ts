import { formatINR } from "@/lib/format";
import { INDIAN_STATES_AND_UNION_TERRITORIES } from "@/lib/indian-states";
import {
  normalizeUnitNumber,
  PROPERTY_TYPES,
  UNIT_STATUSES,
} from "@/lib/properties";
import {
  hasErrors,
  MAX_MONTHLY_RENT,
  MAX_SECURITY_DEPOSIT,
  parseWholeNumber,
  type FieldErrors,
  type ValidationResult,
} from "@/lib/validation";
import type {
  Property,
  PropertyInput,
  PropertyType,
  RentalUnit,
  RentalUnitInput,
  UnitStatus,
} from "@/types/property";

export type { FieldErrors, ValidationResult } from "@/lib/validation";

// Property

export type PropertyFormValues = {
  name: string;
  propertyType: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  description: string;
};

export function propertyToFormValues(property?: Property): PropertyFormValues {
  return {
    name: property?.name ?? "",
    propertyType: property?.propertyType ?? "",
    address: property?.address ?? "",
    city: property?.city ?? "",
    state: property?.state ?? "",
    pincode: property?.pincode ?? "",
    description: property?.description ?? "",
  };
}

export function validatePropertyForm(
  values: PropertyFormValues,
): ValidationResult<PropertyInput, PropertyFormValues> {
  const errors: FieldErrors<PropertyFormValues> = {};
  const name = values.name.trim();
  const address = values.address.trim();
  const city = values.city.trim();
  const pincode = values.pincode.trim();
  const description = values.description.trim();

  if (!name) errors.name = "Enter a property name.";
  else if (name.length < 2) errors.name = "Property name must be at least 2 characters.";
  else if (name.length > 80) errors.name = "Property name must be 80 characters or fewer.";

  if (!PROPERTY_TYPES.includes(values.propertyType as PropertyType)) {
    errors.propertyType = "Select a property type.";
  }

  if (!address) errors.address = "Enter the street address.";
  else if (address.length < 5) errors.address = "Address is too short. Include the street and area.";
  else if (address.length > 200) errors.address = "Address must be 200 characters or fewer.";

  if (!city) errors.city = "Enter a city.";
  else if (city.length > 60) errors.city = "City must be 60 characters or fewer.";
  else if (!/^[\p{L}][\p{L} .'-]*$/u.test(city)) {
    errors.city = "City can only contain letters, spaces, hyphens, full stops and apostrophes.";
  }

  if (!INDIAN_STATES_AND_UNION_TERRITORIES.includes(values.state)) {
    errors.state = "Select a state or union territory.";
  }

  if (!pincode) errors.pincode = "Enter a pincode.";
  else if (!/^[1-9]\d{5}$/.test(pincode)) {
    errors.pincode = "Enter a valid 6-digit pincode, for example 560066.";
  }

  if (description.length > 500) {
    errors.description = "Description must be 500 characters or fewer.";
  }

  if (hasErrors(errors)) return { success: false, errors };

  return {
    success: true,
    data: {
      name,
      propertyType: values.propertyType as PropertyType,
      address,
      city,
      state: values.state,
      pincode,
      description,
    },
  };
}

// Rental unit

export type UnitFormValues = {
  unitNumber: string;
  floor: string;
  bedrooms: string;
  bathrooms: string;
  monthlyRent: string;
  securityDeposit: string;
  status: string;
};

export function unitToFormValues(unit?: RentalUnit): UnitFormValues {
  return {
    unitNumber: unit?.unitNumber ?? "",
    floor: unit?.floor?.toString() ?? "",
    bedrooms: unit?.bedrooms?.toString() ?? "",
    bathrooms: unit?.bathrooms?.toString() ?? "",
    monthlyRent: unit?.monthlyRent.toString() ?? "",
    securityDeposit: unit?.securityDeposit?.toString() ?? "",
    status: unit?.status ?? "",
  };
}

type OptionalWholeNumber =
  | { ok: true; value: number | undefined }
  | { ok: false };

function parseOptionalInRange(raw: string, min: number, max: number): OptionalWholeNumber {
  if (!raw.trim()) return { ok: true, value: undefined };
  const value = parseWholeNumber(raw);
  if (value === null || value < min || value > max) return { ok: false };
  return { ok: true, value };
}

export type UnitValidationContext = {
  /** Units already in the same property. */
  siblingUnits: RentalUnit[];
  /** The unit being edited, excluded from the duplicate check. */
  currentUnitId?: string;
  /** Tenant on the unit's active tenancy; such a unit can't be marked vacant. */
  activeTenantName?: string;
};

export function validateUnitForm(
  values: UnitFormValues,
  { siblingUnits, currentUnitId, activeTenantName }: UnitValidationContext,
): ValidationResult<RentalUnitInput, UnitFormValues> {
  const errors: FieldErrors<UnitFormValues> = {};
  const unitNumber = values.unitNumber.trim().replace(/\s+/g, " ");

  if (!unitNumber) errors.unitNumber = "Enter a unit number.";
  else if (unitNumber.length > 20) {
    errors.unitNumber = "Unit number must be 20 characters or fewer.";
  } else if (!/^[A-Za-z0-9][A-Za-z0-9 ./-]*$/.test(unitNumber)) {
    errors.unitNumber =
      "Use letters, numbers, spaces, hyphens, slashes or full stops.";
  } else {
    const key = normalizeUnitNumber(unitNumber);
    const duplicate = siblingUnits.find(
      (unit) =>
        unit.id !== currentUnitId && normalizeUnitNumber(unit.unitNumber) === key,
    );
    if (duplicate) {
      errors.unitNumber = `Unit ${duplicate.unitNumber} already exists in this property.`;
    }
  }

  const floor = parseOptionalInRange(values.floor, -5, 200);
  if (!floor.ok) errors.floor = "Floor must be a whole number from -5 to 200.";

  const bedrooms = parseOptionalInRange(values.bedrooms, 0, 20);
  if (!bedrooms.ok) errors.bedrooms = "Bedrooms must be a whole number from 0 to 20.";

  const bathrooms = parseOptionalInRange(values.bathrooms, 0, 20);
  if (!bathrooms.ok) errors.bathrooms = "Bathrooms must be a whole number from 0 to 20.";

  let monthlyRent = 0;
  if (!values.monthlyRent.trim()) {
    errors.monthlyRent = "Enter the monthly rent.";
  } else {
    const parsed = parseWholeNumber(values.monthlyRent);
    if (parsed === null) errors.monthlyRent = "Enter the rent as a whole number of rupees.";
    else if (parsed <= 0) errors.monthlyRent = "Monthly rent must be more than ₹0.";
    else if (parsed > MAX_MONTHLY_RENT) {
      errors.monthlyRent = `Monthly rent must be ${formatINR(MAX_MONTHLY_RENT)} or less.`;
    } else monthlyRent = parsed;
  }

  const securityDeposit = parseOptionalInRange(
    values.securityDeposit,
    0,
    MAX_SECURITY_DEPOSIT,
  );
  if (!securityDeposit.ok) {
    errors.securityDeposit = `Enter the deposit as a whole number of rupees, up to ${formatINR(MAX_SECURITY_DEPOSIT)}.`;
  }

  if (!UNIT_STATUSES.includes(values.status as UnitStatus)) {
    errors.status = "Select an occupancy status.";
  } else if (values.status === "Vacant" && activeTenantName) {
    errors.status = `${activeTenantName} has an active tenancy here. End it from their tenant profile to make the unit vacant.`;
  }

  if (
    hasErrors(errors) ||
    !floor.ok ||
    !bedrooms.ok ||
    !bathrooms.ok ||
    !securityDeposit.ok
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      unitNumber,
      floor: floor.value,
      bedrooms: bedrooms.value,
      bathrooms: bathrooms.value,
      monthlyRent,
      securityDeposit: securityDeposit.value,
      status: values.status as UnitStatus,
    },
  };
}
