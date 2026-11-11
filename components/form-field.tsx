import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

/** Moves focus to the form's first invalid control once errors have rendered. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  });
}

export type FormControlProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

type FormFieldProps = {
  id: string;
  label: string;
  optional?: boolean;
  description?: string;
  error?: string;
  className?: string;
  children: (control: FormControlProps) => React.ReactNode;
};

export function FormField({
  id,
  label,
  optional = false,
  description,
  error,
  className,
  children,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");

  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground">(optional)</span>
        )}
      </FieldLabel>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
