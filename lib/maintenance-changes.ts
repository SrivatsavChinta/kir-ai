import { isCalendarDate, toCalendarDate } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import {
  checkAssociations,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
  STATUS_TRANSITIONS,
  type PortfolioRecords,
} from "@/lib/maintenance";
import { validateNote } from "@/lib/maintenance-validation";
import type { MutationResult } from "@/lib/mutation";
import type {
  MaintenanceEventType,
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceRequestInput,
  MaintenanceStatus,
  Vendor,
  VendorChoice,
  VendorInput,
} from "@/types/maintenance";

export type PlannedEvent = { eventType: MaintenanceEventType; description: string };

const FIELD_LABELS: Partial<Record<keyof MaintenanceRequestInput, string>> = {
  title: "title",
  description: "description",
  category: "category",
  propertyId: "property",
  unitId: "unit",
  tenantId: "tenant",
  reportedAt: "reported date",
  targetResolutionDate: "target resolution date",
};

function listFields(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

export function checkMaintenanceInput(
  input: MaintenanceRequestInput,
  today: string,
  records: PortfolioRecords,
  current?: MaintenanceRequest,
): MutationResult<string | undefined> {
  if (!input.title.trim() || !input.description.trim()) {
    return { ok: false, error: "A title and description are required." };
  }
  if (!MAINTENANCE_CATEGORIES.includes(input.category)) {
    return { ok: false, error: "Choose an issue category." };
  }
  if (!MAINTENANCE_PRIORITIES.includes(input.priority)) {
    return { ok: false, error: "Choose a priority." };
  }
  if (!isCalendarDate(input.reportedAt) || input.reportedAt > today) {
    return { ok: false, error: "Enter a reported date that isn't in the future." };
  }
  if (
    input.targetResolutionDate &&
    (!isCalendarDate(input.targetResolutionDate) || input.targetResolutionDate < input.reportedAt)
  ) {
    return { ok: false, error: "The target date can't be before the reported date." };
  }
  if (current?.resolvedAt && input.reportedAt > toCalendarDate(current.resolvedAt)) {
    return { ok: false, error: "The reported date can't be after the request was resolved." };
  }
  const check = checkAssociations(input, records);
  if (!check.ok) {
    return { ok: false, error: Object.values(check.errors)[0] ?? "Check the property, unit and tenant." };
  }
  return { ok: true, value: check.tenancyId };
}

export function resolveVendorChoice(
  choice: VendorChoice,
  vendors: Vendor[],
): MutationResult<{ vendor?: Vendor; create?: VendorInput }> {
  if (choice.kind === "none") return { ok: true, value: {} };
  if (choice.kind === "existing") {
    const vendor = vendors.find((candidate) => candidate.id === choice.vendorId);
    return vendor
      ? { ok: true, value: { vendor } }
      : { ok: false, error: "That vendor no longer exists." };
  }
  const name = choice.vendor.name.trim().toLowerCase();
  const duplicate = vendors.find(
    (candidate) =>
      candidate.name.toLowerCase() === name ||
      (!!choice.vendor.phone && candidate.phone === choice.vendor.phone),
  );
  if (duplicate) {
    return {
      ok: false,
      error: `${duplicate.name} is already a vendor. Select them from the list instead.`,
    };
  }
  return { ok: true, value: { create: choice.vendor } };
}

export function vendorChangeEvent(
  previous: Vendor | undefined,
  next: { id?: string; name: string } | undefined,
  created: boolean,
): PlannedEvent | null {
  if (previous?.id && next?.id && previous.id === next.id) return null;
  if (!previous && !next) return null;
  const newLabel = created ? " (new vendor)" : "";
  if (!previous && next) {
    return { eventType: "vendor_assigned", description: `Assigned to ${next.name}${newLabel}` };
  }
  if (previous && !next) {
    return { eventType: "vendor_removed", description: `${previous.name} removed as vendor` };
  }
  return {
    eventType: "vendor_changed",
    description: `Vendor changed from ${previous?.name ?? "unknown vendor"} to ${next?.name}${newLabel}`,
  };
}

export function planStatusChange(
  request: MaintenanceRequest,
  status: MaintenanceStatus,
  note?: string,
): MutationResult<{ events: PlannedEvent[] }> {
  if (!STATUS_TRANSITIONS[request.status].includes(status)) {
    return { ok: false, error: `A request that is ${request.status} can't be moved to ${status}.` };
  }
  let noteText: string | undefined;
  if (note?.trim()) {
    const checkedNote = validateNote(note);
    if (!checkedNote.success) return { ok: false, error: checkedNote.error };
    noteText = checkedNote.data;
  }

  let statusEvent: PlannedEvent;
  if (status === "Resolved") {
    statusEvent = { eventType: "resolved", description: `Marked resolved (was ${request.status})` };
  } else if (status === "Closed") {
    statusEvent = { eventType: "closed", description: "Request closed" };
  } else if (request.status === "Resolved") {
    const previously = request.resolvedAt
      ? ` Previously resolved on ${formatDateTime(request.resolvedAt)}.`
      : "";
    statusEvent = { eventType: "reopened", description: `Reopened as ${status}.${previously}` };
  } else {
    statusEvent = {
      eventType: "status_changed",
      description: `Status changed from ${request.status} to ${status}`,
    };
  }
  const events = [statusEvent];
  if (noteText) events.push({ eventType: "note_added", description: noteText });
  return { ok: true, value: { events } };
}

export function detailEvents(
  existing: MaintenanceRequest,
  input: MaintenanceRequestInput,
  previousVendor: Vendor | undefined,
  nextVendor: { id?: string; name: string } | undefined,
  createdVendor: boolean,
): PlannedEvent[] {
  const changed = (Object.keys(FIELD_LABELS) as (keyof MaintenanceRequestInput)[]).filter(
    (field) => (existing[field] ?? "") !== (input[field] ?? ""),
  );
  const events: PlannedEvent[] = [];
  if (changed.length > 0) {
    const labels = changed.map((field) => FIELD_LABELS[field] as string);
    events.push({ eventType: "details_updated", description: `Updated ${listFields(labels)}` });
  }
  if (existing.priority !== input.priority) {
    events.push({
      eventType: "priority_changed",
      description: `Priority changed from ${existing.priority} to ${input.priority}`,
    });
  }
  const assigned = vendorChangeEvent(previousVendor, nextVendor, createdVendor);
  if (assigned) events.push(assigned);
  return events;
}

export function priorityEvent(
  existing: MaintenanceRequest,
  priority: MaintenancePriority,
): MutationResult<PlannedEvent | null> {
  if (existing.status === "Closed") return { ok: false, error: "Closed requests can't be changed." };
  if (!MAINTENANCE_PRIORITIES.includes(priority)) return { ok: false, error: "Choose a priority." };
  if (existing.priority === priority) return { ok: true, value: null };
  return {
    ok: true,
    value: {
      eventType: "priority_changed",
      description: `Priority changed from ${existing.priority} to ${priority}`,
    },
  };
}
