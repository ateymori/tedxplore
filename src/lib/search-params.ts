/**
 * Search params in the App Router are `string | string[] | undefined` — a
 * repeated key (`?returnTo=/a&returnTo=/b`) arrives as an array. Collapsing to
 * the first value keeps every reader from having to decide what a duplicate
 * means, and keeps a duplicated key from smuggling past a validator that only
 * expected a string.
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
