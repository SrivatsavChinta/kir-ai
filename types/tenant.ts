/** A person who rents, or has rented, a unit. Independent of any tenancy. */
export type Tenant = {
  id: string;
  fullName: string;
  /** Stored as "+91 98450 12345". */
  phone: string;
  email: string;
  currentAddress?: string;
  emergencyContact?: EmergencyContact;
};

export type EmergencyContact = {
  name: string;
  phone: string;
};

export type TenantInput = Omit<Tenant, "id">;

/** Active while the tenant has an active tenancy; Former once all have ended. */
export type TenantStatus = "Active" | "Former";
