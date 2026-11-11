const KNOWN_FAILURES = [
  "An ended tenancy can't be changed",
  "A tenancy cannot move to a different tenant",
  "A unit with an active tenancy can't be marked vacant",
  "This payment would exceed the rent due",
  "A payment can only be allocated",
  "The rent obligation must belong",
  "Closed requests can't be changed",
  "A request that is",
  "This tenancy has already ended",
  "This tenancy no longer exists",
  "Only an active tenancy can be changed",
  "Choose a different unit",
  "You need to be logged in",
  "A document can only be linked",
  "Document files must be stored",
  "The unit must belong to this property",
  "The tenancy must belong",
  "The tenancy does not belong",
  "Maintenance events are historical",
  "A maintenance event must belong",
  "landlord_id cannot be changed",
  "landlord_id must be the signed-in landlord",
  "This maintenance request no longer exists",
];

/** A message safe to show after a Supabase error. Database internals stay hidden. */
export function dbError(error: { message: string; code?: string }): string {
  const message = error.message ?? "";
  if (/jwt|invalid claim|session expired|not authenticated/i.test(message)) {
    return "Your session has expired. Log in again.";
  }

  if (error.code === "23505" || /duplicate key/i.test(message)) {
    if (message.includes("tenants_landlord_phone")) {
      return "Another tenant already has this phone number.";
    }
    if (message.includes("tenants_landlord_email") || message.includes("email")) {
      return "Another tenant already has this email address.";
    }
    if (message.includes("unit_number")) {
      return "That unit number is already used in this property.";
    }
    if (message.includes("tenancies_one_active_per_unit")) {
      return "That unit already has an active tenancy.";
    }
    if (message.includes("tenancies_one_active_per_tenant")) {
      return "This tenant already has an active tenancy.";
    }
    if (message.includes("billing_month")) {
      return "That month's rent is already recorded.";
    }
    return "That record already exists.";
  }

  if (KNOWN_FAILURES.some((line) => message.includes(line))) {
    return message.split("\n")[0] ?? message;
  }

  return "That change couldn't be saved. Try again.";
}

export const SESSION_EXPIRED = "Your session has expired. Log in again.";
