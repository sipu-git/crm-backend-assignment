import type { FilterQuery } from "mongoose";

export function combineFilters<T>(...filters: Array<FilterQuery<T> | Record<string, unknown>>): FilterQuery<T> {
  const active = filters.filter((filter) => Object.keys(filter).length > 0);
  if (active.length === 0) return {};
  if (active.length === 1) return active[0] as FilterQuery<T>;
  return { $and: active as FilterQuery<T>[] };
}

export function escapedSearch(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&"), "i");
}
