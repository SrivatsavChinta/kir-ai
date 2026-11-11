"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  ArrowRightLeft,
  CircleCheck,
  CirclePlus,
  Flag,
  HardHat,
  Lock,
  Mail,
  MessageSquareText,
  Pencil,
  Phone,
  RotateCcw,
  SearchX,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { AssignVendorDialog } from "@/components/maintenance/assign-vendor-dialog";
import { ChangeStatusDialog, statusActionLabel } from "@/components/maintenance/change-status-dialog";
import {
  MaintenancePriorityBadge,
  MaintenanceStatusBadge,
} from "@/components/maintenance/maintenance-badges";
import { useMaintenance } from "@/components/maintenance/maintenance-provider";
import { useRequestDialog } from "@/components/maintenance/use-request-dialog";
import { PageHeader } from "@/components/page-header";
import { usePortfolio } from "@/components/portfolio-provider";
import { useFormatters } from "@/components/settings/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone, phoneHref, pluralize } from "@/lib/format";
import {
  getDaysOverdue,
  MAINTENANCE_PRIORITIES,
  MAX_NOTE_LENGTH,
  resolveMaintenanceRow,
  STATUS_TRANSITIONS,
  type MaintenanceRow,
} from "@/lib/maintenance";
import type {
  MaintenanceEvent,
  MaintenanceEventType,
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceStatus,
} from "@/types/maintenance";

const EVENT_ICONS: Record<MaintenanceEventType, LucideIcon> = {
  created: CirclePlus,
  details_updated: Pencil,
  priority_changed: Flag,
  status_changed: ArrowRightLeft,
  resolved: CircleCheck,
  reopened: RotateCcw,
  closed: Lock,
  vendor_assigned: HardHat,
  vendor_changed: HardHat,
  vendor_removed: HardHat,
  note_added: MessageSquareText,
};

export function MaintenanceDetail({ requestId }: { requestId: string }) {
  const { today, properties, units, tenants, tenancies } = usePortfolio();
  const { requests, vendors, events } = useMaintenance();
  const { openEdit, showNotice, dialogs } = useRequestDialog();
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    key: number;
    target: MaintenanceStatus | null;
  }>({ open: false, key: 0, target: null });
  const [vendorDialog, setVendorDialog] = useState({ open: false, key: 0 });

  const request = requests.find((candidate) => candidate.id === requestId);
  if (!request) return <MaintenanceNotFound />;

  const row = resolveMaintenanceRow(request, { properties, units, tenants, tenancies, vendors });
  const history = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.requestId === request.id)
    .sort(
      (a, b) =>
        Date.parse(b.event.timestamp) - Date.parse(a.event.timestamp) || b.index - a.index,
    )
    .map(({ event }) => event);
  const closed = request.status === "Closed";

  function openStatus(target: MaintenanceStatus) {
    showNotice(null);
    setStatusDialog((state) => ({ open: true, key: state.key + 1, target }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.title}
        back={{ href: "/maintenance", label: "Maintenance" }}
        description={row.location}
        actions={
          !closed && (
            <Button variant="outline" size="lg" onClick={() => openEdit(request)}>
              <Pencil data-icon="inline-start" />
              Edit request
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <MaintenanceStatusBadge status={request.status} />
          <MaintenancePriorityBadge priority={request.priority} />
          <Badge variant="secondary">{request.category}</Badge>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <RequestDetailsCard row={row} today={today} />
          <ActivityCard
            request={request}
            history={history}
            onNoteAdded={() =>
              showNotice({ tone: "success", title: "Note added", message: "Your note is now in the request's history." })
            }
          />
        </div>
        <div className="order-first space-y-6 lg:order-none">
          <ManageCard
            request={request}
            onStatus={openStatus}
            onPriorityChanged={(priority) =>
              showNotice({
                tone: "success",
                title: "Priority updated",
                message: `“${request.title}” is now ${priority} priority.`,
              })
            }
          />
          <LocationCard row={row} />
          <VendorCard
            row={row}
            closed={closed}
            onChange={() => {
              showNotice(null);
              setVendorDialog((state) => ({ open: true, key: state.key + 1 }));
            }}
          />
        </div>
      </div>

      <ChangeStatusDialog
        open={statusDialog.open}
        onOpenChange={(open) => setStatusDialog((state) => ({ ...state, open }))}
        formKey={statusDialog.key}
        request={request}
        target={statusDialog.target}
        onChanged={(updated) =>
          showNotice({
            tone: "success",
            title: `Request ${updated.status === "Open" ? "reopened" : updated.status.toLowerCase()}`,
            message:
              updated.status === "Open"
                ? "The earlier resolution is kept in the history."
                : `“${updated.title}” is now ${updated.status}.`,
          })
        }
      />
      <AssignVendorDialog
        open={vendorDialog.open}
        onOpenChange={(open) => setVendorDialog((state) => ({ ...state, open }))}
        formKey={vendorDialog.key}
        request={request}
        onAssigned={(updated) => {
          const vendor = vendors.find((candidate) => candidate.id === updated.assignedVendorId);
          showNotice({
            tone: "success",
            title: "Vendor updated",
            message: updated.assignedVendorId
              ? `${vendor?.name ?? "The vendor"} is assigned to this request.`
              : "No vendor is assigned to this request.",
          });
        }}
      />
      {dialogs}
    </div>
  );
}

function RequestDetailsCard({ row, today }: { row: MaintenanceRow; today: string }) {
  const { request } = row;
  const { formatDate, formatDateTime } = useFormatters();
  const overdue = getDaysOverdue(request, today);
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Request details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1 text-sm">
          <h3 className="text-muted-foreground">Description</h3>
          <p className="break-words whitespace-pre-wrap">{request.description}</p>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <DetailItem label="Category">{request.category}</DetailItem>
          <DetailItem label="Priority">
            <MaintenancePriorityBadge priority={request.priority} />
          </DetailItem>
          <DetailItem label="Status">
            <MaintenanceStatusBadge status={request.status} />
          </DetailItem>
          <DetailItem label="Reported">{formatDate(request.reportedAt)}</DetailItem>
          <DetailItem
            label="Target resolution"
            note={overdue > 0 ? `${pluralize(overdue, "day")} overdue` : undefined}
            noteClassName="text-destructive"
          >
            {request.targetResolutionDate ? (
              formatDate(request.targetResolutionDate)
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </DetailItem>
          <DetailItem label="Resolved">
            {request.resolvedAt ? (
              formatDateTime(request.resolvedAt)
            ) : (
              <span className="text-muted-foreground">Not yet</span>
            )}
          </DetailItem>
          <DetailItem label="Created">{formatDateTime(request.createdAt)}</DetailItem>
          <DetailItem label="Last updated">{formatDateTime(request.updatedAt)}</DetailItem>
        </dl>
      </CardContent>
    </Card>
  );
}

type ManageCardProps = {
  request: MaintenanceRequest;
  onStatus: (target: MaintenanceStatus) => void;
  onPriorityChanged: (priority: MaintenancePriority) => void;
};

function ManageCard({ request, onStatus, onPriorityChanged }: ManageCardProps) {
  const { changePriority } = useMaintenance();
  const lock = useSubmitLock();
  const [priority, setPriority] = useState(request.priority);
  const [error, setError] = useState<string>();
  const transitions = STATUS_TRANSITIONS[request.status];
  const closed = request.status === "Closed";

  // Follow priority changes made elsewhere, such as the edit dialog.
  const [syncedPriority, setSyncedPriority] = useState(request.priority);
  if (syncedPriority !== request.priority) {
    setSyncedPriority(request.priority);
    setPriority(request.priority);
  }

  async function savePriority(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lock.acquire()) return;
    const result = await changePriority(request.id, priority);
    lock.release();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    onPriorityChanged(priority);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Status &amp; priority
        </CardTitle>
        <CardDescription>
          {closed ? "This request is closed." : "Every change is recorded in the history."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-muted-foreground">Status</span>
            <MaintenanceStatusBadge status={request.status} />
          </p>
          {transitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {transitions.map((target) => (
                <Button
                  key={target}
                  variant={target === "Resolved" || target === "Closed" ? "default" : "outline"}
                  onClick={() => onStatus(target)}
                >
                  {statusActionLabel(request.status, target)}
                </Button>
              ))}
            </div>
          )}
        </div>
        {!closed && (
          <form onSubmit={savePriority} className="space-y-2">
            <label htmlFor="quick-priority" className="block text-muted-foreground">
              Priority
            </label>
            <div className="flex gap-2">
              <NativeSelect
                id="quick-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as MaintenancePriority)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "quick-priority-error" : undefined}
                className="w-full"
              >
                {MAINTENANCE_PRIORITIES.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <SubmitButton
                variant="outline"
                pending={lock.pending}
                pendingLabel="Updating…"
                disabled={priority === request.priority}
              >
                Update
              </SubmitButton>
            </div>
            <FormError id="quick-priority-error" message={error} />
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function LocationCard({ row }: { row: MaintenanceRow }) {
  const { request, property, unit, tenant, tenancy } = row;
  const { formatDate } = useFormatters();
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Property &amp; tenant
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-4 text-sm">
          <DetailItem label="Property">
            {property ? (
              <Link href={`/properties/${property.id}`} className="underline-offset-4 hover:underline">
                {property.name}
              </Link>
            ) : (
              "Unknown property"
            )}
            {property && (
              <span className="block font-normal text-muted-foreground">{property.city}</span>
            )}
          </DetailItem>
          <DetailItem label="Rental unit">
            {request.unitId ? (
              <>
                {unit?.unitNumber ?? "Unknown unit"}
                {unit && (
                  <span className="block font-normal text-muted-foreground">
                    Currently {unit.status.toLowerCase()}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Whole property</span>
            )}
          </DetailItem>
          <DetailItem label="Tenant">
            {tenant ? (
              <>
                <Link href={`/tenants/${tenant.id}`} className="underline-offset-4 hover:underline">
                  {tenant.fullName}
                </Link>
                <a
                  href={phoneHref(tenant.phone)}
                  className="block font-normal text-muted-foreground tabular-nums underline-offset-4 hover:underline"
                >
                  {formatPhone(tenant.phone)}
                </a>
              </>
            ) : (
              <span className="text-muted-foreground">Not reported by a tenant</span>
            )}
          </DetailItem>
          {tenancy && (
            <DetailItem label="Tenancy">
              <span className="font-normal">
                {formatDate(tenancy.moveInDate)} –{" "}
                {tenancy.moveOutDate ? formatDate(tenancy.moveOutDate) : "present"}
              </span>{" "}
              {tenancy.status === "Ended" && <Badge variant="outline">Ended</Badge>}
            </DetailItem>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function VendorCard({
  row,
  closed,
  onChange,
}: {
  row: MaintenanceRow;
  closed: boolean;
  onChange: () => void;
}) {
  const { vendor } = row;
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Vendor
        </CardTitle>
        {!closed && (
          <CardAction>
            <Button variant="outline" onClick={onChange}>
              {vendor ? "Change" : "Assign"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {vendor ? (
          <dl className="space-y-3">
            <DetailItem label="Name">{vendor.name}</DetailItem>
            <DetailItem label="Service">{vendor.serviceCategory}</DetailItem>
            {vendor.phone && (
              <DetailItem label="Phone" icon={Phone}>
                <a
                  href={phoneHref(vendor.phone)}
                  className="tabular-nums underline-offset-4 hover:underline"
                >
                  {formatPhone(vendor.phone)}
                </a>
              </DetailItem>
            )}
            {vendor.email && (
              <DetailItem label="Email" icon={Mail}>
                <a href={`mailto:${vendor.email}`} className="break-all underline-offset-4 hover:underline">
                  {vendor.email}
                </a>
              </DetailItem>
            )}
            {vendor.notes && (
              <DetailItem label="Notes">
                <span className="font-normal">{vendor.notes}</span>
              </DetailItem>
            )}
          </dl>
        ) : (
          <p className="text-muted-foreground">
            {row.request.assignedVendorId ? "The assigned vendor no longer exists." : "No vendor assigned yet."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type ActivityCardProps = {
  request: MaintenanceRequest;
  history: MaintenanceEvent[];
  onNoteAdded: () => void;
};

function ActivityCard({ request, history, onNoteAdded }: ActivityCardProps) {
  const { addNote } = useMaintenance();
  const { formatDateTime } = useFormatters();
  const lock = useSubmitLock();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const noteCount = history.filter((event) => event.eventType === "note_added").length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lock.acquire()) return;
    const result = await addNote(request.id, note);
    lock.release();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNote("");
    setError(undefined);
    onNoteAdded();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Notes &amp; activity
        </CardTitle>
        <CardDescription>
          {pluralize(history.length, "event")} · {pluralize(noteCount, "note")}, newest first
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form noValidate onSubmit={handleSubmit} className="space-y-2">
          <label htmlFor="new-note" className="text-sm font-medium">
            Add a note
          </label>
          <Textarea
            id="new-note"
            rows={2}
            maxLength={MAX_NOTE_LENGTH + 100}
            value={note}
            placeholder="e.g. Plumber visiting Saturday at 10 am"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "new-note-error" : undefined}
            onChange={(event) => {
              setNote(event.target.value);
              setError(undefined);
            }}
          />
          <FormError id="new-note-error" message={error} />
          <SubmitButton variant="outline" pending={lock.pending} pendingLabel="Adding…">
            <MessageSquareText data-icon="inline-start" />
            Add note
          </SubmitButton>
        </form>

        <ol className="space-y-4">
          {history.map((event) => {
            const Icon = EVENT_ICONS[event.eventType];
            const isNote = event.eventType === "note_added";
            return (
              <li key={event.id} className="flex gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
                    isNote && "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                  {isNote ? (
                    <>
                      <p className="text-xs font-medium text-muted-foreground">Note</p>
                      <p className="rounded-lg bg-muted/60 px-3 py-2 break-words whitespace-pre-wrap">
                        {event.description}
                      </p>
                    </>
                  ) : (
                    <p className="font-medium break-words">{event.description}</p>
                  )}
                  <time dateTime={event.timestamp} className="block text-xs text-muted-foreground">
                    {formatDateTime(event.timestamp)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

type DetailItemProps = {
  label: string;
  icon?: LucideIcon;
  note?: string;
  noteClassName?: string;
  children: React.ReactNode;
};

function DetailItem({ label, icon: Icon, note, noteClassName, children }: DetailItemProps) {
  const indent = Icon ? "pl-6" : undefined;
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
        {label}
      </dt>
      <dd className={cn("font-medium break-words", indent)}>{children}</dd>
      {note && <dd className={cn("text-xs text-muted-foreground", indent, noteClassName)}>{note}</dd>}
    </div>
  );
}

function MaintenanceNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      titleAs="h1"
      title="Maintenance request not found"
      description="This request doesn't exist in your portfolio."
      action={
        <Link href="/maintenance" className={buttonVariants({ variant: "outline" })}>
          Back to maintenance
        </Link>
      }
      className="py-16"
    />
  );
}
