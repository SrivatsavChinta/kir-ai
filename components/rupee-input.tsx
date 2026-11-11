import { Input } from "@/components/ui/input";

type RupeeInputProps = Omit<React.ComponentProps<typeof Input>, "onChange"> & {
  onChange: (value: string) => void;
};

export function RupeeInput({ onChange, ...props }: RupeeInputProps) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
      >
        ₹
      </span>
      <Input
        {...props}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        className="pl-6"
      />
    </div>
  );
}
