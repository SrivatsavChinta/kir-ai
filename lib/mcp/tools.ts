import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

import {
  beginTenancy,
  createProperty,
  createTenant,
  createUnit,
  recordRentPayment,
  saveProperty,
  saveTenant,
  saveUnit,
} from "@/lib/data/actions/portfolio";
import { createDocumentUrl } from "@/lib/data/actions/documents";
import {
  createMaintenanceRequest,
  saveMaintenanceRequest,
  saveMaintenanceStatus,
} from "@/lib/data/actions/maintenance";
import { dbError } from "@/lib/data/errors";
import {
  mapDocument,
  mapMaintenanceEvent,
  mapMaintenanceRequest,
  mapProperty,
  mapTenancy,
  mapTenant,
  mapUnit,
  type DocumentRow,
  type MaintenanceEventRow,
  type MaintenanceRequestRow,
  type PropertyRow,
  type TenancyRow,
  type TenantRow,
  type UnitRow,
} from "@/lib/data/mappers";
import { syncRentObligations } from "@/lib/data/obligations";
import { readPortfolioSlice, requireSession } from "@/lib/data/workspace";
import { toCalendarDate } from "@/lib/dates";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES } from "@/lib/maintenance";
import { toolError, toolOk, type ToolResult } from "@/lib/mcp/results";
import type { MutationResult } from "@/lib/mutation";
import { PAYMENT_METHODS, buildRentLedger } from "@/lib/rent-calculations";
import type { Property } from "@/types/property";
import type { TenantInput } from "@/types/tenant";

const LIMIT = 100;

const propertyType = z.enum(["Apartment Building", "Independent House", "Villa"]);
const unitStatus = z.enum(["Occupied", "Vacant"]);
const maintenanceCategory = z.enum(tuple(MAINTENANCE_CATEGORIES));
const maintenancePriority = z.enum(tuple(MAINTENANCE_PRIORITIES));
const maintenanceStatus = z.enum(tuple(MAINTENANCE_STATUSES));
const paymentMethod = z.enum(tuple(PAYMENT_METHODS));
const rentStatus = z.enum(["Paid", "Partially paid", "Pending", "Overdue"]);
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const month = z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM.");

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

/**
 * Tools call the same server actions and rent functions as the kir.ai screens.
 * The landlord comes from the OAuth token on the request, never from arguments.
 */
export function registerKiraiTools(server: McpServer) {
  server.registerTool(
    "list_properties",
    {
      title: "List properties",
      description: "List the signed-in landlord's properties. Does not accept a landlord id.",
      inputSchema: z.object({}).strict(),
      annotations: readOnly,
    },
    async () => {
      const loaded = await loadRows<PropertyRow>("properties");
      if (!loaded.ok) return toolError(loaded.error);
      const properties = loaded.rows.map(mapProperty);
      return toolOk(`Found ${properties.length} ${plural(properties.length, "property", "properties")}.`, capped("properties", properties));
    },
  );

  server.registerTool(
    "get_property",
    {
      title: "Get property",
      description: "Get one property belonging to the signed-in landlord, including its units.",
      inputSchema: z.object({ propertyId: z.uuid() }).strict(),
      annotations: readOnly,
    },
    async ({ propertyId }) => {
      const property = await loadProperty(propertyId);
      if (!property.ok) return toolError(property.error);
      const units = await loadRows<UnitRow>("rental_units");
      if (!units.ok) return toolError(units.error);
      return toolOk(`Property "${property.value.name}".`, {
        property: property.value,
        units: units.rows.filter((unit) => unit.property_id === propertyId).map(mapUnit),
      });
    },
  );

  server.registerTool(
    "list_units",
    {
      title: "List units",
      description: "List rental units. Optionally limit the list to one property.",
      inputSchema: z.object({ propertyId: z.uuid().optional() }).strict(),
      annotations: readOnly,
    },
    async ({ propertyId }) => {
      const loaded = await loadRows<UnitRow>("rental_units");
      if (!loaded.ok) return toolError(loaded.error);
      const units = loaded.rows.filter((unit) => !propertyId || unit.property_id === propertyId).map(mapUnit);
      return toolOk(`Found ${units.length} ${plural(units.length, "unit", "units")}.`, capped("units", units));
    },
  );

  server.registerTool(
    "list_tenants",
    {
      title: "List tenants",
      description: "List the signed-in landlord's tenants.",
      inputSchema: z.object({}).strict(),
      annotations: readOnly,
    },
    async () => {
      const loaded = await loadRows<TenantRow>("tenants");
      if (!loaded.ok) return toolError(loaded.error);
      const tenants = loaded.rows.map(mapTenant);
      return toolOk(`Found ${tenants.length} ${plural(tenants.length, "tenant", "tenants")}.`, capped("tenants", tenants));
    },
  );

  server.registerTool(
    "get_tenant",
    {
      title: "Get tenant",
      description: "Get one tenant and that tenant's tenancies.",
      inputSchema: z.object({ tenantId: z.uuid() }).strict(),
      annotations: readOnly,
    },
    async ({ tenantId }) => {
      const tenant = await loadOne<TenantRow>("tenants", tenantId, "That tenant no longer exists.");
      if (!tenant.ok) return toolError(tenant.error);
      const tenancies = await loadRows<TenancyRow>("tenancies");
      if (!tenancies.ok) return toolError(tenancies.error);
      return toolOk(`Tenant ${tenant.row.full_name}.`, {
        tenant: mapTenant(tenant.row),
        tenancies: tenancies.rows.filter((tenancy) => tenancy.tenant_id === tenantId).map(mapTenancy),
      });
    },
  );

  server.registerTool(
    "list_tenancies",
    {
      title: "List tenancies",
      description: "List tenancies. Filter by tenant, unit or status. Ended tenancies stay in the history.",
      inputSchema: z
        .object({
          tenantId: z.uuid().optional(),
          unitId: z.uuid().optional(),
          status: z.enum(["Active", "Ended"]).optional(),
        })
        .strict(),
      annotations: readOnly,
    },
    async ({ tenantId, unitId, status }) => {
      const loaded = await loadRows<TenancyRow>("tenancies");
      if (!loaded.ok) return toolError(loaded.error);
      const tenancies = loaded.rows
        .filter((tenancy) => !tenantId || tenancy.tenant_id === tenantId)
        .filter((tenancy) => !unitId || tenancy.unit_id === unitId)
        .filter((tenancy) => !status || tenancy.status === status)
        .map(mapTenancy);
      return toolOk(`Found ${tenancies.length} ${plural(tenancies.length, "tenancy", "tenancies")}.`, capped("tenancies", tenancies));
    },
  );

  server.registerTool(
    "list_rent_obligations",
    {
      title: "List rent obligations",
      description:
        "List rent bills for the signed-in landlord, including balance and status. Use status Overdue for unpaid rent whose due date has passed. Amounts are whole rupees. Bills keep the amount from when they were created.",
      inputSchema: z
        .object({
          tenancyId: z.uuid().optional(),
          billingMonth: month.optional(),
          status: rentStatus.optional(),
        })
        .strict(),
      annotations: readOnly,
    },
    async (input) => {
      const ledger = await rentLedger();
      if (!ledger.ok) return toolError(ledger.error);
      const obligations = ledger.value
        .filter((entry) => !input.tenancyId || entry.tenancy.id === input.tenancyId)
        .filter((entry) => !input.billingMonth || entry.obligation.billingMonth === input.billingMonth)
        .filter((entry) => !input.status || entry.status === input.status)
        .map((entry) => ({
          id: entry.obligation.id,
          tenancyId: entry.tenancy.id,
          tenantName: entry.tenantName,
          location: entry.location,
          billingMonth: entry.obligation.billingMonth,
          dueDate: entry.obligation.dueDate,
          expectedAmount: entry.obligation.expectedAmount,
          amountPaid: entry.amountPaid,
          balance: entry.balance,
          status: entry.status,
          daysOverdue: entry.daysOverdue,
        }));
      return toolOk(`Found ${obligations.length} rent ${plural(obligations.length, "bill", "bills")}.`, capped("obligations", obligations));
    },
  );

  server.registerTool(
    "list_payments",
    {
      title: "List rent payments",
      description: "List rent payments received by the signed-in landlord. Dates are calendar dates.",
      inputSchema: z
        .object({
          tenancyId: z.uuid().optional(),
          fromDate: calendarDate.optional(),
          toDate: calendarDate.optional(),
        })
        .strict(),
      annotations: readOnly,
    },
    async ({ tenancyId, fromDate, toDate }) => {
      const session = await requireSession();
      if (!session.ok) return toolError(session.error);
      const portfolio = await readPortfolioSlice(session.supabase);
      if (!portfolio.ok) return toolError(portfolio.error);
      const payments = portfolio.payments.filter((payment) => {
        if (tenancyId && payment.tenancyId !== tenancyId) return false;
        if (fromDate && payment.paymentDate < fromDate) return false;
        if (toDate && payment.paymentDate > toDate) return false;
        return true;
      });
      return toolOk(`Found ${payments.length} ${plural(payments.length, "payment", "payments")}.`, capped("payments", payments));
    },
  );

  server.registerTool(
    "list_maintenance_requests",
    {
      title: "List maintenance requests",
      description: "List maintenance requests. Filter by status or property.",
      inputSchema: z.object({ status: maintenanceStatus.optional(), propertyId: z.uuid().optional() }).strict(),
      annotations: readOnly,
    },
    async ({ status, propertyId }) => {
      const loaded = await loadRows<MaintenanceRequestRow>("maintenance_requests");
      if (!loaded.ok) return toolError(loaded.error);
      const requests = loaded.rows
        .filter((request) => !status || request.status === status)
        .filter((request) => !propertyId || request.property_id === propertyId)
        .map(mapMaintenanceRequest);
      return toolOk(`Found ${requests.length} maintenance ${plural(requests.length, "request", "requests")}.`, capped("requests", requests));
    },
  );

  server.registerTool(
    "get_maintenance_request",
    {
      title: "Get maintenance request",
      description: "Get one maintenance request and its activity history. History entries are not editable.",
      inputSchema: z.object({ requestId: z.uuid() }).strict(),
      annotations: readOnly,
    },
    async ({ requestId }) => {
      const request = await loadOne<MaintenanceRequestRow>("maintenance_requests", requestId, "This maintenance request no longer exists.");
      if (!request.ok) return toolError(request.error);
      const session = await requireSession();
      if (!session.ok) return toolError(session.error);
      const { data, error } = await session.supabase
        .from("maintenance_events")
        .select("*")
        .eq("request_id", requestId)
        .order("occurred_at")
        .order("id");
      if (error) return toolError(dbError(error));
      return toolOk(`Maintenance request "${request.row.title}".`, {
        request: mapMaintenanceRequest(request.row),
        events: ((data ?? []) as MaintenanceEventRow[]).map(mapMaintenanceEvent),
      });
    },
  );

  server.registerTool(
    "list_documents",
    {
      title: "List documents",
      description:
        "List document metadata. Files stay in private storage. Pass documentId and includeSignedUrl true to get one download URL that expires in 120 seconds. Uploading a file through this connector is not supported.",
      inputSchema: z
        .object({
          associationType: z.enum(["property", "tenant", "tenancy"]).optional(),
          associatedRecordId: z.uuid().optional(),
          documentId: z.uuid().optional(),
          includeSignedUrl: z.boolean().optional(),
        })
        .strict(),
      annotations: readOnly,
    },
    async (input) => {
      const loaded = await loadRows<DocumentRow>("documents");
      if (!loaded.ok) return toolError(loaded.error);
      let documents = loaded.rows.map(mapDocument);
      if (input.associationType) documents = documents.filter((document) => document.associationType === input.associationType);
      if (input.associatedRecordId) {
        documents = documents.filter((document) => document.associatedRecordId === input.associatedRecordId);
      }
      if (input.documentId) documents = documents.filter((document) => document.id === input.documentId);
      if (input.includeSignedUrl && !input.documentId) {
        return toolError("Pass documentId to create a signed download URL for one document.");
      }
      const listed = [];
      for (const document of documents.slice(0, LIMIT)) {
        let signedUrl: string | null = null;
        if (input.includeSignedUrl) {
          const url = await createDocumentUrl(document.storagePath, document.originalFileName);
          if (!url.ok) return toolError("The download link couldn't be created. The file may no longer be stored.");
          signedUrl = url.url;
        }
        listed.push(publicDocument(document, signedUrl));
      }
      return toolOk(
        input.includeSignedUrl
          ? "Created a download link that expires in 120 seconds."
          : `Found ${documents.length} ${plural(documents.length, "document", "documents")}.`,
        { documents: listed, truncated: documents.length > LIMIT, signedUrlExpiresInSeconds: input.includeSignedUrl ? 120 : null },
      );
    },
  );

  server.registerTool(
    "create_property",
    {
      title: "Create property",
      description:
        "Create a property for the signed-in landlord. propertyType is Apartment Building, Independent House or Villa. state is an Indian state or union territory, for example Karnataka. pincode is 6 digits.",
      inputSchema: z
        .object({
          name: z.string(),
          propertyType,
          address: z.string(),
          city: z.string(),
          state: z.string(),
          pincode: z.string(),
          description: z.string().optional(),
        })
        .strict(),
      annotations: write,
    },
    async (input) =>
      saved(
        await createProperty({ ...input, description: input.description ?? "" }),
        (property) => `Created property "${property.name}" (${property.id}) in ${property.city}.`,
        (property) => ({ property }),
      ),
  );

  server.registerTool(
    "update_property",
    {
      title: "Update property",
      description: "Change a property. Only the fields you send are changed. The property must belong to the signed-in landlord.",
      inputSchema: z
        .object({
          propertyId: z.uuid(),
          name: z.string().optional(),
          propertyType: propertyType.optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          pincode: z.string().optional(),
          description: z.string().optional(),
        })
        .strict(),
      annotations: write,
    },
    async ({ propertyId, ...patch }) => {
      const existing = await loadProperty(propertyId);
      if (!existing.ok) return toolError(existing.error);
      return saved(
        await saveProperty(propertyId, { ...existing.value, ...defined(patch) }),
        (property) => `Updated property "${property.name}" (${property.id}).`,
        (property) => ({ property }),
      );
    },
  );

  server.registerTool(
    "create_unit",
    {
      title: "Create unit",
      description:
        "Add a rental unit to a property. monthlyRent is whole rupees. status is Occupied or Vacant. A unit cannot be marked Vacant while it has an active tenancy.",
      inputSchema: z
        .object({
          propertyId: z.uuid(),
          unitNumber: z.string(),
          floor: z.number().int().optional(),
          bedrooms: z.number().int().optional(),
          bathrooms: z.number().int().optional(),
          monthlyRent: z.number().int().nonnegative(),
          securityDeposit: z.number().int().nonnegative().optional(),
          status: unitStatus,
        })
        .strict(),
      annotations: write,
    },
    async ({ propertyId, ...input }) =>
      saved(
        await createUnit(propertyId, input),
        (unit) => `Created unit ${unit.unitNumber} (${unit.id}).`,
        (unit) => ({ unit }),
      ),
  );

  server.registerTool(
    "update_unit",
    {
      title: "Update unit",
      description: "Change a rental unit. Only the fields you send are changed. Active tenancy rules still apply.",
      inputSchema: z
        .object({
          unitId: z.uuid(),
          unitNumber: z.string().optional(),
          floor: z.number().int().nullable().optional(),
          bedrooms: z.number().int().nullable().optional(),
          bathrooms: z.number().int().nullable().optional(),
          monthlyRent: z.number().int().nonnegative().optional(),
          securityDeposit: z.number().int().nonnegative().nullable().optional(),
          status: unitStatus.optional(),
        })
        .strict(),
      annotations: write,
    },
    async ({ unitId, ...patch }) => {
      const existing = await loadOne<UnitRow>("rental_units", unitId, "That rental unit no longer exists.");
      if (!existing.ok) return toolError(existing.error);
      const current = mapUnit(existing.row);
      return saved(
        await saveUnit(unitId, {
          unitNumber: patch.unitNumber ?? current.unitNumber,
          floor: patch.floor === undefined ? current.floor : (patch.floor ?? undefined),
          bedrooms: patch.bedrooms === undefined ? current.bedrooms : (patch.bedrooms ?? undefined),
          bathrooms: patch.bathrooms === undefined ? current.bathrooms : (patch.bathrooms ?? undefined),
          monthlyRent: patch.monthlyRent ?? current.monthlyRent,
          securityDeposit:
            patch.securityDeposit === undefined ? current.securityDeposit : (patch.securityDeposit ?? undefined),
          status: patch.status ?? current.status,
        }),
        (unit) => `Updated unit ${unit.unitNumber} (${unit.id}).`,
        (unit) => ({ unit }),
      );
    },
  );

  server.registerTool(
    "create_tenant",
    {
      title: "Create tenant",
      description:
        "Create a tenant without starting a tenancy. Phone is an Indian mobile number. Use create_tenancy to move the tenant into a unit.",
      inputSchema: tenantFields.strict(),
      annotations: write,
    },
    async (input) =>
      saved(
        await createTenant(toTenantInput(input)),
        (tenant) => `Created tenant ${tenant.fullName} (${tenant.id}).`,
        (tenant) => ({ tenant }),
      ),
  );

  server.registerTool(
    "update_tenant",
    {
      title: "Update tenant",
      description: "Change a tenant's contact details. Only the fields you send are changed. Tenancy history is kept.",
      inputSchema: tenantFields.partial().extend({ tenantId: z.uuid() }).strict(),
      annotations: write,
    },
    async ({ tenantId, ...patch }) => {
      const existing = await loadOne<TenantRow>("tenants", tenantId, "That tenant no longer exists.");
      if (!existing.ok) return toolError(existing.error);
      const current = mapTenant(existing.row);
      return saved(
        await saveTenant(tenantId, {
          fullName: patch.fullName ?? current.fullName,
          phone: patch.phone ?? current.phone,
          email: patch.email ?? current.email,
          currentAddress: patch.currentAddress ?? current.currentAddress,
          emergencyContact:
            patch.emergencyContactName || patch.emergencyContactPhone
              ? {
                  name: patch.emergencyContactName ?? current.emergencyContact?.name ?? "",
                  phone: patch.emergencyContactPhone ?? current.emergencyContact?.phone ?? "",
                }
              : current.emergencyContact,
        }),
        (tenant) => `Updated tenant ${tenant.fullName} (${tenant.id}).`,
        (tenant) => ({ tenant }),
      );
    },
  );

  server.registerTool(
    "create_tenancy",
    {
      title: "Create tenancy",
      description:
        "Start a tenancy for an existing tenant and vacant unit. Rent, deposit and dates are stored on the tenancy. One active tenancy is allowed per tenant and per unit. Dates are YYYY-MM-DD. rentDueDay is 1–28.",
      inputSchema: z
        .object({
          tenantId: z.uuid(),
          unitId: z.uuid(),
          monthlyRent: z.number().int().positive(),
          securityDeposit: z.number().int().nonnegative(),
          rentDueDay: z.number().int().min(1).max(28),
          moveInDate: calendarDate,
          agreementStartDate: calendarDate,
          agreementEndDate: calendarDate,
        })
        .strict(),
      annotations: write,
    },
    async ({ tenantId, ...terms }) =>
      saved(
        await beginTenancy(tenantId, terms),
        (value) => `Started a tenancy (${value.tenancy.id}) for unit ${value.unit.unitNumber}.`,
        (value) => ({ tenancy: value.tenancy, unit: value.unit }),
      ),
  );

  server.registerTool(
    "record_rent_payment",
    {
      title: "Record rent payment",
      description:
        "Record money received against one rent bill. The amount cannot exceed the outstanding balance. Pass obligationId, or tenancyId plus billingMonth (YYYY-MM). Amounts are whole rupees.",
      inputSchema: z
        .object({
          tenancyId: z.uuid(),
          obligationId: z.string().optional(),
          billingMonth: month.optional(),
          amount: z.number().int().positive(),
          paymentDate: calendarDate,
          paymentMethod,
          transactionReference: z.string().optional(),
          notes: z.string().optional(),
        })
        .strict(),
      annotations: write,
    },
    async (input) => {
      if (!input.obligationId && !input.billingMonth) {
        return toolError("Say which rent bill this payment is for, with obligationId or billingMonth.");
      }
      const ledger = await rentLedger();
      if (!ledger.ok) return toolError(ledger.error);
      const match = ledger.value.find((entry) => {
        if (entry.tenancy.id !== input.tenancyId) return false;
        if (input.obligationId) return entry.obligation.id === input.obligationId;
        return entry.obligation.billingMonth === input.billingMonth;
      });
      if (!match) return toolError("That rent isn't billed to this tenancy.");
      return saved(
        await recordRentPayment({
          tenancyId: input.tenancyId,
          obligationId: match.obligation.id,
          amount: input.amount,
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          transactionReference: input.transactionReference,
          notes: input.notes,
        }),
        (payment) => `Recorded ${payment.amount} rupees received on ${payment.paymentDate} (${payment.id}).`,
        (payment) => ({ payment, obligationId: match.obligation.id, billingMonth: match.obligation.billingMonth }),
      );
    },
  );

  server.registerTool(
    "create_maintenance_request",
    {
      title: "Create maintenance request",
      description:
        "Create a maintenance request on a property. Unit and tenant are optional. reportedAt defaults to today in India. The request starts Open and the activity history records that it was created.",
      inputSchema: z
        .object({
          title: z.string(),
          description: z.string(),
          category: maintenanceCategory,
          priority: maintenancePriority,
          propertyId: z.uuid(),
          unitId: z.uuid().optional(),
          tenantId: z.uuid().optional(),
          reportedAt: calendarDate.optional(),
          targetResolutionDate: calendarDate.optional(),
        })
        .strict(),
      annotations: write,
    },
    async (input) =>
      saved(
        await createMaintenanceRequest(
          {
            title: input.title,
            description: input.description,
            category: input.category,
            priority: input.priority,
            propertyId: input.propertyId,
            unitId: input.unitId,
            tenantId: input.tenantId,
            reportedAt: input.reportedAt ?? toCalendarDate(new Date().toISOString()),
            targetResolutionDate: input.targetResolutionDate,
          },
          { kind: "none" },
        ),
        (value) => `Created maintenance request "${value.request.title}" (${value.request.id}).`,
        (value) => ({ request: value.request }),
      ),
  );

  server.registerTool(
    "update_maintenance_request",
    {
      title: "Update maintenance request",
      description: "Change the details of an open maintenance request. Only the fields you send are changed. Closed requests cannot be edited.",
      inputSchema: z
        .object({
          requestId: z.uuid(),
          title: z.string().optional(),
          description: z.string().optional(),
          category: maintenanceCategory.optional(),
          priority: maintenancePriority.optional(),
          propertyId: z.uuid().optional(),
          unitId: z.uuid().nullable().optional(),
          tenantId: z.uuid().nullable().optional(),
          reportedAt: calendarDate.optional(),
          targetResolutionDate: calendarDate.nullable().optional(),
        })
        .strict(),
      annotations: write,
    },
    async ({ requestId, ...patch }) => {
      const existing = await loadOne<MaintenanceRequestRow>(
        "maintenance_requests",
        requestId,
        "This maintenance request no longer exists.",
      );
      if (!existing.ok) return toolError(existing.error);
      const current = mapMaintenanceRequest(existing.row);
      const next = { ...current, ...defined(patch) };
      return saved(
        await saveMaintenanceRequest(
          requestId,
          {
            title: next.title,
            description: next.description,
            category: next.category,
            priority: next.priority,
            propertyId: next.propertyId,
            unitId: next.unitId ?? undefined,
            tenantId: next.tenantId ?? undefined,
            reportedAt: next.reportedAt,
            targetResolutionDate: next.targetResolutionDate ?? undefined,
          },
          current.assignedVendorId ? { kind: "existing", vendorId: current.assignedVendorId } : { kind: "none" },
        ),
        (value) => `Updated maintenance request "${value.request.title}" (${value.request.id}).`,
        (value) => ({ request: value.request }),
      );
    },
  );

  server.registerTool(
    "update_maintenance_status",
    {
      title: "Update maintenance status",
      description:
        "Change a maintenance request's status to Open, In Progress, On Hold, Resolved or Closed. The change is added to the request's history. A note is optional.",
      inputSchema: z
        .object({
          requestId: z.uuid(),
          status: maintenanceStatus,
          note: z.string().optional(),
        })
        .strict(),
      annotations: write,
    },
    async ({ requestId, status, note }) =>
      saved(
        await saveMaintenanceStatus(requestId, status, note),
        (value) => `Maintenance request "${value.request.title}" is now ${value.request.status}.`,
        (value) => ({ request: value.request }),
      ),
  );
}

const tenantFields = z.object({
  fullName: z.string(),
  phone: z.string(),
  email: z.string(),
  currentAddress: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

function saved<T>(
  result: MutationResult<T>,
  confirmation: (value: T) => string,
  data: (value: T) => Record<string, unknown>,
): ToolResult {
  if (!result.ok) return toolError(result.error);
  return toolOk(confirmation(result.value), data(result.value));
}

async function rentLedger() {
  const session = await requireSession();
  if (!session.ok) return session;
  const portfolio = await readPortfolioSlice(session.supabase);
  if (!portfolio.ok) return portfolio;
  const today = toCalendarDate(new Date().toISOString());
  const obligations = await syncRentObligations(session.supabase, session.userId, portfolio.tenancies, today);
  if (!obligations.ok) return obligations;
  return { ok: true as const, value: buildRentLedger({ ...portfolio, obligations: obligations.value }, today) };
}

async function loadProperty(id: string): Promise<{ ok: true; value: Property } | { ok: false; error: string }> {
  const row = await loadOne<PropertyRow>("properties", id, "That property no longer exists.");
  if (!row.ok) return row;
  return { ok: true, value: mapProperty(row.row) };
}

async function loadRows<T>(table: string): Promise<{ ok: true; rows: T[] } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { data, error } = await session.supabase.from(table).select("*");
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, rows: (data ?? []) as T[] };
}

async function loadOne<T>(
  table: string,
  id: string,
  missing: string,
): Promise<{ ok: true; row: T } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { data, error } = await session.supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: missing };
  return { ok: true, row: data as T };
}

function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function tuple<T extends string>(values: readonly T[]): [T, ...T[]] {
  return values as unknown as [T, ...T[]];
}

function toTenantInput(input: {
  fullName: string;
  phone: string;
  email: string;
  currentAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}): TenantInput {
  const name = input.emergencyContactName?.trim();
  const phone = input.emergencyContactPhone?.trim();
  return {
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    currentAddress: input.currentAddress,
    emergencyContact: name && phone ? { name, phone } : undefined,
  };
}

function capped<T>(key: string, rows: T[]): Record<string, unknown> {
  return { [key]: rows.slice(0, LIMIT), truncated: rows.length > LIMIT };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function publicDocument(document: ReturnType<typeof mapDocument>, signedUrl: string | null) {
  return {
    id: document.id,
    name: document.name,
    category: document.category,
    description: document.description ?? null,
    associationType: document.associationType,
    associatedRecordId: document.associatedRecordId,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    uploadedAt: document.uploadedAt,
    signedUrl,
  };
}
