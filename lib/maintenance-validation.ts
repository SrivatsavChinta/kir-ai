import { isCalendarDate, toCalendarDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import {
  checkAssociations,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_TITLE_LENGTH,
  type PortfolioRecords,
} from "@/lib/maintenance";
import {
  EMAIL_HINT,
  hasErrors,
  isValidEmail,
  normalizeIndianMobile,
  PHONE_HINT,
  type FieldErrors,
  type ValidationResult,
} from "@/lib/validation";
import type {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceRequestInput,
  Vendor,
  VendorChoice,
  VendorInput,
} from "@/types/maintenance";

/** Vendor select value for adding a new vendor. */
export const NEW_VENDOR = "new";

const EARLIEST_REPORTED_DATE = "2000-01-01";
const MAX_VENDOR_NAME_LENGTH = 80;
const MAX_VENDOR_NOTES_LENGTH = 300;

// Vendor

export type VendorFormValues = {
  name: string;
  serviceCategory: MaintenanceCategory | "";
  phone: string;
  email: string;
  notes: string;
};

export const emptyVendorValues = (
  serviceCategory: MaintenanceCategory | "" = "",
): VendorFormValues => ({ name: "", serviceCategory, phone: "", email: "", notes: "" });

/** Validates a new vendor, rejecting one that duplicates an existing vendor's name or phone. */
export function validateVendorForm(
  values: VendorFormValues,
  vendors: Vendor[],
): ValidationResult<VendorInput, VendorFormValues> {
  const errors: FieldErrors<VendorFormValues> = {};

  const name = values.name.trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Enter the vendor's name.";
  else if (name.length > MAX_VENDOR_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_VENDOR_NAME_LENGTH} characters or fewer.`;
  } else {
    const existing = vendors.find((vendor) => vendor.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      errors.name = `${existing.name} is already a vendor. Select them from the list instead.`;
    }
  }

  if (!values.serviceCategory) errors.serviceCategory = "Choose the service they provide.";

  const phoneRaw = values.phone.trim();
  const phone = phoneRaw ? normalizeIndianMobile(phoneRaw) : undefined;
  if (phoneRaw && !phone) {
    errors.phone = PHONE_HINT;
  } else if (phone) {
    const existing = vendors.find((vendor) => vendor.phone === phone);
    if (existing) {
      errors.phone = `${existing.name} already has this phone number. Select them from the list instead.`;
    }
  }

  const email = values.email.trim().toLowerCase();
  if (email && !isValidEmail(email)) errors.email = EMAIL_HINT;

  const notes = values.notes.trim();
  if (notes.length > MAX_VENDOR_NOTES_LENGTH) {
    errors.notes = `Notes must be ${MAX_VENDOR_NOTES_LENGTH} characters or fewer.`;
  }

  if (hasErrors(errors) || !values.serviceCategory) return { success: false, errors };
  return {
    success: true,
    data: {
      name,
      serviceCategory: values.serviceCategory,
      phone: phone ?? undefined,
      email: email || undefined,
      notes: notes || undefined,
    },
  };
}

// Request

export type MaintenanceFormValues = {
  title: string;
  description: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  category: MaintenanceCategory | "";
  priority: MaintenancePriority | "";
  reportedAt: string;
  targetResolutionDate: string;
  /** "", an existing vendor's id, or NEW_VENDOR. */
  vendorId: string;
  vendor: VendorFormValues;
};

export type MaintenanceFormErrors = FieldErrors<Omit<MaintenanceFormValues, "vendor">> & {
  vendor?: FieldErrors<VendorFormValues>;
};

export type MaintenanceFormOutput = { input: MaintenanceRequestInput; vendor: VendorChoice };

export type MaintenanceValidationContext = PortfolioRecords & {
  vendors: Vendor[];
  /** Requests can't be reported after this day (YYYY-MM-DD). */
  today: string;
  /** The request being edited. */
  current?: MaintenanceRequest;
};

export function requestToFormValues(request: MaintenanceRequest): MaintenanceFormValues {
  return {
    title: request.title,
    description: request.description,
    propertyId: request.propertyId,
    unitId: request.unitId ?? "",
    tenantId: request.tenantId ?? "",
    category: request.category,
    priority: request.priority,
    reportedAt: request.reportedAt,
    targetResolutionDate: request.targetResolutionDate ?? "",
    vendorId: request.assignedVendorId ?? "",
    vendor: emptyVendorValues(request.category),
  };
}

/** Errors in the property, unit and tenant combination, shown as soon as they occur. */
export function getAssociationErrors(
  values: Pick<MaintenanceFormValues, "propertyId" | "unitId" | "tenantId" | "reportedAt">,
  records: PortfolioRecords,
  today: string,
): MaintenanceFormErrors {
  if (!values.propertyId) return {};
  const check = checkAssociations(
    {
      propertyId: values.propertyId,
      unitId: values.unitId || undefined,
      tenantId: values.tenantId || undefined,
      reportedAt: isCalendarDate(values.reportedAt) ? values.reportedAt : today,
    },
    records,
  );
  return check.ok ? {} : check.errors;
}

export function validateMaintenanceForm(
  values: MaintenanceFormValues,
  context: MaintenanceValidationContext,
): { success: true; data: MaintenanceFormOutput } | { success: false; errors: MaintenanceFormErrors } {
  const { today, current } = context;
  const errors: MaintenanceFormErrors = {};

  const title = values.title.trim().replace(/\s+/g, " ");
  if (!title) errors.title = "Enter a short title for the issue.";
  else if (title.length < 3) errors.title = "Title must be at least 3 characters.";
  else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }

  const description = values.description.trim();
  if (!description) errors.description = "Describe the issue so whoever fixes it knows what to expect.";
  else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  if (!values.propertyId) errors.propertyId = "Choose the property with the issue.";
  if (!values.category || !MAINTENANCE_CATEGORIES.includes(values.category)) {
    errors.category = "Choose an issue category.";
  }
  if (!values.priority || !MAINTENANCE_PRIORITIES.includes(values.priority)) {
    errors.priority = "Choose a priority.";
  }

  const resolvedDate = current?.resolvedAt ? toCalendarDate(current.resolvedAt) : undefined;
  if (!values.reportedAt) errors.reportedAt = "Enter the date the issue was reported.";
  else if (!isCalendarDate(values.reportedAt)) errors.reportedAt = "Enter a valid date.";
  else if (values.reportedAt > today) {
    errors.reportedAt = `The reported date can't be in the future (after ${formatDate(today)}).`;
  } else if (values.reportedAt < EARLIEST_REPORTED_DATE) {
    errors.reportedAt = `Enter a date from ${formatDate(EARLIEST_REPORTED_DATE)} onwards.`;
  } else if (resolvedDate && values.reportedAt > resolvedDate) {
    errors.reportedAt = `This request was resolved on ${formatDate(resolvedDate)}, so it must have been reported by then.`;
  }

  if (values.targetResolutionDate) {
    if (!isCalendarDate(values.targetResolutionDate)) {
      errors.targetResolutionDate = "Enter a valid date.";
    } else if (isCalendarDate(values.reportedAt) && values.targetResolutionDate < values.reportedAt) {
      errors.targetResolutionDate = `The target date can't be before the reported date (${formatDate(values.reportedAt)}).`;
    }
  }

  Object.assign(errors, getAssociationErrors(values, context, today));

  let vendor: VendorChoice = { kind: "none" };
  if (values.vendorId === NEW_VENDOR) {
    const checked = validateVendorForm(values.vendor, context.vendors);
    if (checked.success) vendor = { kind: "new", vendor: checked.data };
    else errors.vendor = checked.errors;
  } else if (values.vendorId) {
    if (context.vendors.some((candidate) => candidate.id === values.vendorId)) {
      vendor = { kind: "existing", vendorId: values.vendorId };
    } else {
      errors.vendorId = "That vendor no longer exists. Choose another.";
    }
  }

  const { vendor: vendorErrors, ...fieldErrors } = errors;
  if (
    hasErrors(fieldErrors) ||
    (vendorErrors && hasErrors(vendorErrors)) ||
    !values.category ||
    !values.priority
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      input: {
        title,
        description,
        category: values.category,
        priority: values.priority,
        propertyId: values.propertyId,
        unitId: values.unitId || undefined,
        tenantId: values.tenantId || undefined,
        reportedAt: values.reportedAt,
        targetResolutionDate: values.targetResolutionDate || undefined,
      },
      vendor,
    },
  };
}

export function validateNote(raw: string): { success: true; data: string } | { success: false; error: string } {
  const note = raw.trim();
  if (!note) return { success: false, error: "Write a note before adding it." };
  if (note.length > MAX_NOTE_LENGTH) {
    return { success: false, error: `Notes must be ${MAX_NOTE_LENGTH} characters or fewer.` };
  }
  return { success: true, data: note };
}
