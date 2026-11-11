"use client";

import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { NEW_VENDOR } from "@/lib/maintenance-validation";
import type { MaintenanceCategory, Vendor } from "@/types/maintenance";

type VendorSelectProps = Omit<React.ComponentProps<typeof NativeSelect>, "children"> & {
  vendors: Vendor[];
  /** Vendors offering this service are listed first. */
  category?: MaintenanceCategory | "";
};

export function VendorSelect({ vendors, category, ...props }: VendorSelectProps) {
  const sorted = [...vendors].sort((a, b) => a.name.localeCompare(b.name));
  const matching = category ? sorted.filter((vendor) => vendor.serviceCategory === category) : [];
  const others = sorted.filter((vendor) => !matching.includes(vendor));
  const option = (vendor: Vendor) => (
    <NativeSelectOption key={vendor.id} value={vendor.id}>
      {vendor.name} · {vendor.serviceCategory}
    </NativeSelectOption>
  );

  return (
    <NativeSelect className="w-full" {...props}>
      <NativeSelectOption value="">No vendor yet</NativeSelectOption>
      {matching.length > 0 && (
        <NativeSelectOptGroup label={`${category} vendors`}>{matching.map(option)}</NativeSelectOptGroup>
      )}
      {others.length > 0 &&
        (matching.length > 0 ? (
          <NativeSelectOptGroup label="Other vendors">{others.map(option)}</NativeSelectOptGroup>
        ) : (
          others.map(option)
        ))}
      <NativeSelectOption value={NEW_VENDOR}>+ Add a new vendor…</NativeSelectOption>
    </NativeSelect>
  );
}

/** "Plumbing · +91 90000 41021 · name@example.com" */
export function describeVendor(vendor: Vendor): string {
  return [vendor.serviceCategory, vendor.phone, vendor.email].filter(Boolean).join(" · ");
}
