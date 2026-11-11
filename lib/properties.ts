import type {
  Property,
  PropertyType,
  RentalUnit,
  UnitStatus,
  UnitSummary,
} from "@/types/property";

export const PROPERTY_TYPES: readonly PropertyType[] = [
  "Apartment Building",
  "Independent House",
  "Villa",
];

export const UNIT_STATUSES: readonly UnitStatus[] = ["Occupied", "Vacant"];

export function getUnitsForProperty(
  units: RentalUnit[],
  propertyId: string,
): RentalUnit[] {
  return units
    .filter((unit) => unit.propertyId === propertyId)
    .sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
    );
}

export function summarizeUnits(units: RentalUnit[]): UnitSummary {
  let occupiedUnits = 0;
  let occupiedMonthlyRent = 0;
  let vacantMonthlyRent = 0;

  for (const unit of units) {
    if (unit.status === "Occupied") {
      occupiedUnits += 1;
      occupiedMonthlyRent += unit.monthlyRent;
    } else {
      vacantMonthlyRent += unit.monthlyRent;
    }
  }

  return {
    totalUnits: units.length,
    occupiedUnits,
    vacantUnits: units.length - occupiedUnits,
    potentialMonthlyRent: occupiedMonthlyRent + vacantMonthlyRent,
    occupiedMonthlyRent,
    vacantMonthlyRent,
    occupancyPercent:
      units.length === 0 ? null : (occupiedUnits / units.length) * 100,
  };
}

export function formatAddress(property: Property): string {
  return `${property.address}, ${property.city}, ${property.state} ${property.pincode}`;
}

export function formatFloor(floor: number | undefined): string {
  if (floor === undefined) return "—";
  if (floor === 0) return "Ground";
  if (floor < 0) return `Basement ${-floor}`;
  return String(floor);
}

export function formatOccupancy(percent: number | null): string {
  return percent === null ? "—" : `${Math.round(percent)}%`;
}

/** Comparison key so "a-101", "A-101" and " A-101 " count as the same unit number. */
export function normalizeUnitNumber(unitNumber: string): string {
  return unitNumber.trim().replace(/\s+/g, " ").toLowerCase();
}
