import type { MaintenanceEvent, MaintenanceRequest, Vendor } from "@/types/maintenance";

// Fictional maintenance records for the sample portfolio in ./properties.ts.
// Vendor names, phone numbers and email addresses are made up.

export const sampleVendors: Vendor[] = [
  {
    id: "vendor-aquafix",
    name: "AquaFix Plumbing Services",
    serviceCategory: "Plumbing",
    phone: "+91 90000 41021",
    email: "bookings@aquafix.example.com",
    notes: "Usually available within 24 hours in Whitefield.",
  },
  {
    id: "vendor-brightspark",
    name: "BrightSpark Electricals",
    serviceCategory: "Electrical",
    phone: "+91 90000 52734",
  },
  {
    id: "vendor-coolair",
    name: "CoolAir Appliance Care",
    serviceCategory: "Appliance",
    phone: "+91 90000 63318",
    email: "service@coolair.example.com",
  },
  {
    id: "vendor-shieldpest",
    name: "ShieldPest Control",
    serviceCategory: "Pest Control",
    phone: "+91 90000 74405",
    notes: "Annual contract for Palm Grove Villas.",
  },
];

export const sampleMaintenanceRequests: MaintenanceRequest[] = [
  {
    id: "mnt-1",
    title: "Geyser not heating",
    description:
      "Bathroom geyser on the first floor runs but the water stays cold. Tenant has checked the switch and MCB.",
    category: "Appliance",
    priority: "Medium",
    status: "Open",
    propertyId: "prop-palmgrove",
    unitId: "unit-villa2",
    tenantId: "tenant-rahul-verma",
    tenancyId: "tenancy-villa2",
    reportedAt: "2026-11-11",
    targetResolutionDate: "2026-11-14",
    createdAt: "2026-11-11T08:40:00+05:30",
    updatedAt: "2026-11-11T08:40:00+05:30",
  },
  {
    id: "mnt-2",
    title: "Water leakage in bathroom",
    description:
      "Water seeping from the wall behind the washbasin and pooling on the floor. Likely a cracked concealed pipe.",
    category: "Plumbing",
    priority: "Urgent",
    status: "In Progress",
    propertyId: "prop-lakeview",
    unitId: "unit-b101",
    tenantId: "tenant-rohan-das",
    tenancyId: "tenancy-b101",
    reportedAt: "2026-11-10",
    targetResolutionDate: "2026-11-12",
    assignedVendorId: "vendor-aquafix",
    createdAt: "2026-11-10T19:20:00+05:30",
    updatedAt: "2026-11-11T11:05:00+05:30",
  },
  {
    id: "mnt-3",
    title: "Air conditioner not cooling",
    description:
      "Bedroom split AC blows warm air. Technician found a faulty compressor capacitor; replacement part is on order.",
    category: "Appliance",
    priority: "High",
    status: "On Hold",
    propertyId: "prop-banjara",
    unitId: "unit-302",
    tenantId: "tenant-meera-joshi",
    tenancyId: "tenancy-302",
    reportedAt: "2026-11-03",
    targetResolutionDate: "2026-11-08",
    assignedVendorId: "vendor-coolair",
    createdAt: "2026-11-03T14:00:00+05:30",
    updatedAt: "2026-11-06T16:30:00+05:30",
  },
  {
    id: "mnt-4",
    title: "Kitchen tap replacement",
    description: "Kitchen sink tap is loose and drips constantly. Replace the tap and washer.",
    category: "Plumbing",
    priority: "Low",
    status: "Resolved",
    propertyId: "prop-lakeview",
    unitId: "unit-a201",
    tenantId: "tenant-sneha-kulkarni",
    tenancyId: "tenancy-a201",
    reportedAt: "2026-11-01",
    targetResolutionDate: "2026-11-07",
    resolvedAt: "2026-11-06T17:15:00+05:30",
    assignedVendorId: "vendor-aquafix",
    createdAt: "2026-11-01T09:00:00+05:30",
    updatedAt: "2026-11-06T17:15:00+05:30",
  },
  {
    id: "mnt-5",
    title: "Lift making grinding noise",
    description:
      "Residents report a grinding sound when the lift passes the 3rd floor. Lift is still running; AMC provider to inspect.",
    category: "Other",
    priority: "High",
    status: "Open",
    propertyId: "prop-banjara",
    reportedAt: "2026-11-05",
    targetResolutionDate: "2026-11-09",
    createdAt: "2026-11-05T10:10:00+05:30",
    updatedAt: "2026-11-05T10:10:00+05:30",
  },
  {
    id: "mnt-6",
    title: "Repaint unit before next tenancy",
    description: "Repaint walls and ceilings in all rooms of the vacant unit and touch up the door frames.",
    category: "Painting",
    priority: "Low",
    status: "In Progress",
    propertyId: "prop-lakeview",
    unitId: "unit-a202",
    reportedAt: "2026-10-05",
    targetResolutionDate: "2026-11-20",
    createdAt: "2026-10-05T12:00:00+05:30",
    updatedAt: "2026-11-02T09:30:00+05:30",
  },
  {
    id: "mnt-7",
    title: "Termite treatment for garden deck",
    description: "Termite trails found on the wooden deck in the shared garden. Annual anti-termite treatment.",
    category: "Pest Control",
    priority: "Medium",
    status: "Closed",
    propertyId: "prop-palmgrove",
    reportedAt: "2026-09-15",
    targetResolutionDate: "2026-09-25",
    resolvedAt: "2026-09-20T15:00:00+05:30",
    assignedVendorId: "vendor-shieldpest",
    createdAt: "2026-09-15T11:00:00+05:30",
    updatedAt: "2026-09-22T10:00:00+05:30",
  },
  {
    id: "mnt-8",
    title: "Wardrobe hinge broken",
    description: "Left door of the bedroom wardrobe has come off its top hinge.",
    category: "Carpentry",
    priority: "Low",
    status: "Closed",
    propertyId: "prop-lakeview",
    unitId: "unit-a202",
    tenantId: "tenant-arjun-mehta",
    tenancyId: "tenancy-a202-arjun",
    reportedAt: "2026-08-12",
    resolvedAt: "2026-08-16T13:00:00+05:30",
    createdAt: "2026-08-12T18:45:00+05:30",
    updatedAt: "2026-08-18T10:00:00+05:30",
  },
  {
    id: "mnt-9",
    title: "Sparking from kitchen socket",
    description:
      "Kitchen socket sparked when the mixer was plugged in. Tenant has switched off that circuit at the MCB.",
    category: "Electrical",
    priority: "Urgent",
    status: "Open",
    propertyId: "prop-banjara",
    unitId: "unit-401",
    tenantId: "tenant-ananya-iyer",
    tenancyId: "tenancy-401",
    reportedAt: "2026-11-11",
    targetResolutionDate: "2026-11-12",
    assignedVendorId: "vendor-brightspark",
    createdAt: "2026-11-11T16:20:00+05:30",
    updatedAt: "2026-11-11T16:25:00+05:30",
  },
];

type EventSeed = Omit<MaintenanceEvent, "id" | "requestId">;

const eventSeeds: Record<string, EventSeed[]> = {
  "mnt-1": [
    { eventType: "created", description: "Request created", timestamp: "2026-11-11T08:40:00+05:30" },
  ],
  "mnt-2": [
    { eventType: "created", description: "Request created", timestamp: "2026-11-10T19:20:00+05:30" },
    {
      eventType: "priority_changed",
      description: "Priority changed from High to Urgent",
      timestamp: "2026-11-10T19:45:00+05:30",
    },
    {
      eventType: "vendor_assigned",
      description: "Assigned to AquaFix Plumbing Services",
      timestamp: "2026-11-10T20:00:00+05:30",
    },
    {
      eventType: "status_changed",
      description: "Status changed from Open to In Progress",
      timestamp: "2026-11-11T11:00:00+05:30",
    },
    {
      eventType: "note_added",
      description: "Plumber has opened the wall. Pipe replacement expected tomorrow morning.",
      timestamp: "2026-11-11T11:05:00+05:30",
    },
  ],
  "mnt-3": [
    { eventType: "created", description: "Request created", timestamp: "2026-11-03T14:00:00+05:30" },
    {
      eventType: "vendor_assigned",
      description: "Assigned to CoolAir Appliance Care",
      timestamp: "2026-11-03T15:10:00+05:30",
    },
    {
      eventType: "status_changed",
      description: "Status changed from Open to In Progress",
      timestamp: "2026-11-04T10:00:00+05:30",
    },
    {
      eventType: "status_changed",
      description: "Status changed from In Progress to On Hold",
      timestamp: "2026-11-06T16:25:00+05:30",
    },
    {
      eventType: "note_added",
      description: "Waiting for the compressor capacitor from the service centre. ETA one week.",
      timestamp: "2026-11-06T16:30:00+05:30",
    },
  ],
  "mnt-4": [
    { eventType: "created", description: "Request created", timestamp: "2026-11-01T09:00:00+05:30" },
    {
      eventType: "vendor_assigned",
      description: "Assigned to AquaFix Plumbing Services",
      timestamp: "2026-11-01T10:00:00+05:30",
    },
    {
      eventType: "resolved",
      description: "Marked resolved (was Open)",
      timestamp: "2026-11-03T12:00:00+05:30",
    },
    {
      eventType: "reopened",
      description: "Reopened as Open. Previously resolved on 3 Nov 2026, 12:00 pm.",
      timestamp: "2026-11-04T09:30:00+05:30",
    },
    {
      eventType: "note_added",
      description: "Tenant reports the new tap still drips. Washer size was wrong.",
      timestamp: "2026-11-04T09:31:00+05:30",
    },
    {
      eventType: "resolved",
      description: "Marked resolved (was Open)",
      timestamp: "2026-11-06T17:15:00+05:30",
    },
  ],
  "mnt-5": [
    { eventType: "created", description: "Request created", timestamp: "2026-11-05T10:10:00+05:30" },
  ],
  "mnt-6": [
    { eventType: "created", description: "Request created", timestamp: "2026-10-05T12:00:00+05:30" },
    {
      eventType: "status_changed",
      description: "Status changed from Open to In Progress",
      timestamp: "2026-11-02T09:30:00+05:30",
    },
  ],
  "mnt-7": [
    { eventType: "created", description: "Request created", timestamp: "2026-09-15T11:00:00+05:30" },
    {
      eventType: "vendor_assigned",
      description: "Assigned to ShieldPest Control",
      timestamp: "2026-09-15T11:30:00+05:30",
    },
    {
      eventType: "resolved",
      description: "Marked resolved (was Open)",
      timestamp: "2026-09-20T15:00:00+05:30",
    },
    { eventType: "closed", description: "Request closed", timestamp: "2026-09-22T10:00:00+05:30" },
  ],
  "mnt-8": [
    { eventType: "created", description: "Request created", timestamp: "2026-08-12T18:45:00+05:30" },
    {
      eventType: "resolved",
      description: "Marked resolved (was Open)",
      timestamp: "2026-08-16T13:00:00+05:30",
    },
    { eventType: "closed", description: "Request closed", timestamp: "2026-08-18T10:00:00+05:30" },
  ],
  "mnt-9": [
    { eventType: "created", description: "Request created", timestamp: "2026-11-11T16:20:00+05:30" },
    {
      eventType: "vendor_assigned",
      description: "Assigned to BrightSpark Electricals",
      timestamp: "2026-11-11T16:25:00+05:30",
    },
  ],
};

export const sampleMaintenanceEvents: MaintenanceEvent[] = Object.entries(eventSeeds).flatMap(
  ([requestId, seeds]) =>
    seeds.map((seed, index) => ({ ...seed, id: `${requestId}-evt-${index + 1}`, requestId })),
);
