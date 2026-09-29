/**
 * React 19 resets a <form action> after every submission, including when the
 * server answers with validation errors. Actions echo the submitted values back
 * (FormState.values) and fields use them as their defaults, so nothing typed is lost.
 */
export type FormValues = Record<string, string | string[]>;

export function valueOf(values: FormValues | undefined, name: string, fallback: string): string {
  const v = values?.[name];
  if (v === undefined) return fallback;
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

/** For checkboxes: once a submission happened, an absent field means "unchecked". */
export function checkedOf(values: FormValues | undefined, name: string, fallback: boolean): boolean {
  if (!values) return fallback;
  const v = values[name];
  return v === "on" || (Array.isArray(v) && v.includes("on"));
}

export function listOf(values: FormValues | undefined, name: string, fallback: string[]): string[] {
  if (!values) return fallback;
  const v = values[name];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}
