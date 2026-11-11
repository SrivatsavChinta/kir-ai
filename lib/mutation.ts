export type MutationResult<T> =
  | { ok: true; value: T }
  /** `field` names the form field the error belongs to, when there is one. */
  | { ok: false; error: string; field?: string };

export function fieldFailure(errors: Record<string, string | undefined>): MutationResult<never> {
  const field = Object.keys(errors).find((key) => errors[key]);
  return {
    ok: false,
    error: (field && errors[field]) || "Check the form and try again.",
    field,
  };
}
