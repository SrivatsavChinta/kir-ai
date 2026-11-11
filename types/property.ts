export type PropertyType = "Apartment Building" | "Independent House" | "Villa";

export type UnitStatus = "Occupied" | "Vacant";

export type Property = {
  id: string;
  name: string;
  propertyType: PropertyType;
  address: string;
  city: string;
  state: string;
  pincode: string;
  description: string;
};

export type RentalUnit = {
  id: string;
  propertyId: string;
  unitNumber: string;
  floor?: number;
  bedrooms?: number;
  bathrooms?: number;
  monthlyRent: number;
  securityDeposit?: number;
  status: UnitStatus;
};

export type PropertyInput = Omit<Property, "id">;

export type RentalUnitInput = Omit<RentalUnit, "id" | "propertyId">;

export type UnitSummary = {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  potentialMonthlyRent: number;
  occupiedMonthlyRent: number;
  vacantMonthlyRent: number;
  /** Null when there are no units. */
  occupancyPercent: number | null;
};
