"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  beginTenancy,
  closeTenancy,
  createProperty,
  createTenantWithTenancy,
  createUnit,
  recordRentPayment,
  saveProperty,
  saveTenancy,
  saveTenant,
  saveUnit,
} from "@/lib/data/actions/portfolio";
import type { PortfolioSnapshot } from "@/lib/data/snapshot";
import type { MutationResult } from "@/lib/mutation";
import type { Payment, PaymentInput } from "@/types/payment";
import type { Property, PropertyInput, RentalUnit, RentalUnitInput } from "@/types/property";
import type { Tenancy, TenancyInput } from "@/types/tenancy";
import type { Tenant, TenantInput } from "@/types/tenant";

export type { MutationResult } from "@/lib/mutation";

type PortfolioContextValue = PortfolioSnapshot & {
  addProperty: (input: PropertyInput) => Promise<MutationResult<Property>>;
  updateProperty: (id: string, input: PropertyInput) => Promise<MutationResult<Property>>;
  addUnit: (propertyId: string, input: RentalUnitInput) => Promise<MutationResult<RentalUnit>>;
  updateUnit: (id: string, input: RentalUnitInput) => Promise<MutationResult<RentalUnit>>;
  addTenant: (
    tenant: TenantInput,
    tenancy: TenancyInput,
  ) => Promise<MutationResult<{ tenant: Tenant; tenancy: Tenancy }>>;
  updateTenant: (id: string, input: TenantInput) => Promise<MutationResult<Tenant>>;
  startTenancy: (tenantId: string, input: TenancyInput) => Promise<MutationResult<Tenancy>>;
  updateTenancy: (tenancyId: string, input: TenancyInput) => Promise<MutationResult<Tenancy>>;
  endTenancy: (tenancyId: string, moveOutDate: string) => Promise<MutationResult<Tenancy>>;
  recordPayment: (input: PaymentInput) => Promise<MutationResult<Payment>>;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

function replaceById<T extends { id: string }>(items: T[], next: T): T[] {
  return items.some((item) => item.id === next.id)
    ? items.map((item) => (item.id === next.id ? next : item))
    : [...items, next];
}

export function PortfolioProvider({
  revision,
  initial,
  children,
}: {
  revision: string;
  initial: PortfolioSnapshot;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState({ revision, snapshot: initial });
  if (state.revision !== revision) {
    setState({ revision, snapshot: initial });
  }
  const snapshot = state.revision === revision ? state.snapshot : initial;

  function adopt(update: (current: PortfolioSnapshot) => PortfolioSnapshot) {
    setState((current) => ({ revision: current.revision, snapshot: update(current.snapshot) }));
    router.refresh();
  }

  const value = useMemo<PortfolioContextValue>(() => {
    return {
      ...snapshot,
      async addProperty(input) {
        const result = await createProperty(input);
        if (!result.ok) return result;
        adopt((current) => ({ ...current, properties: [...current.properties, result.value] }));
        return result;
      },
      async updateProperty(id, input) {
        const result = await saveProperty(id, input);
        if (!result.ok) return result;
        adopt((current) => ({ ...current, properties: replaceById(current.properties, result.value) }));
        return result;
      },
      async addUnit(propertyId, input) {
        const result = await createUnit(propertyId, input);
        if (!result.ok) return result;
        adopt((current) => ({ ...current, units: [...current.units, result.value] }));
        return result;
      },
      async updateUnit(id, input) {
        const result = await saveUnit(id, input);
        if (!result.ok) return result;
        adopt((current) => ({ ...current, units: replaceById(current.units, result.value) }));
        return result;
      },
      async addTenant(tenantInput, tenancyInput) {
        const result = await createTenantWithTenancy(tenantInput, tenancyInput);
        if (!result.ok) return result;
        adopt((current) => ({
          ...current,
          tenants: [...current.tenants, result.value.tenant],
          tenancies: [...current.tenancies, result.value.tenancy],
          units: replaceById(current.units, result.value.unit),
          obligations: result.value.obligations,
        }));
        return { ok: true, value: { tenant: result.value.tenant, tenancy: result.value.tenancy } };
      },
      async updateTenant(id, input) {
        const result = await saveTenant(id, input);
        if (!result.ok) return result;
        adopt((current) => ({ ...current, tenants: replaceById(current.tenants, result.value) }));
        return result;
      },
      async startTenancy(tenantId, input) {
        const result = await beginTenancy(tenantId, input);
        if (!result.ok) return result;
        adopt((current) => ({
          ...current,
          tenancies: [...current.tenancies, result.value.tenancy],
          units: replaceById(current.units, result.value.unit),
          obligations: result.value.obligations,
        }));
        return { ok: true, value: result.value.tenancy };
      },
      async updateTenancy(tenancyId, input) {
        const result = await saveTenancy(tenancyId, input);
        if (!result.ok) return result;
        adopt((current) => ({
          ...current,
          tenancies: result.value.ended
            ? replaceById(replaceById(current.tenancies, result.value.ended), result.value.tenancy)
            : replaceById(current.tenancies, result.value.tenancy),
          units: result.value.units.reduce(replaceById, current.units),
          obligations: result.value.obligations,
        }));
        return { ok: true, value: result.value.tenancy };
      },
      async endTenancy(tenancyId, moveOutDate) {
        const result = await closeTenancy(tenancyId, moveOutDate);
        if (!result.ok) return result;
        adopt((current) => ({
          ...current,
          tenancies: replaceById(current.tenancies, result.value.tenancy),
          units: replaceById(current.units, result.value.unit),
          obligations: result.value.obligations,
        }));
        return { ok: true, value: result.value.tenancy };
      },
      async recordPayment(input) {
        const result = await recordRentPayment(input);
        if (!result.ok) return result;
        adopt((current) => ({ ...current, payments: [...current.payments, result.value] }));
        return result;
      },
    };
    // adopt is recreated each render and only used inside the callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, router]);

  return <PortfolioContext value={value}>{children}</PortfolioContext>;
}

export function usePortfolio(): PortfolioContextValue {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error("usePortfolio must be used within a PortfolioProvider.");
  }
  return context;
}
