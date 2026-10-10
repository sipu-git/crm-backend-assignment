import type { FilterQuery, HydratedDocument, Model, SortOrder } from "mongoose";

export interface PaginationInput {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  createdFrom?: Date;
  createdTo?: Date;
}

export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  input: PaginationInput,
  allowedSortFields: readonly string[],
  defaultSortField = "createdAt",
): Promise<{ items: HydratedDocument<T>[]; meta: { currentPage: number; pageSize: number; totalRecords: number; totalPages: number } }> {
  const page = input.page;
  const limit = input.limit;
  const requestedSort = input.sortBy && allowedSortFields.includes(input.sortBy) ? input.sortBy : defaultSortField;
  const direction = input.sortOrder === "asc" ? 1 : -1;
  const sort: Record<string, SortOrder> = { [requestedSort]: direction === 1 ? "asc" : "desc" };

  const [items, totalRecords] = await Promise.all([
    model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
    model.countDocuments(filter).exec(),
  ]);

  return {
    items,
    meta: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
    },
  };
}

export function addCreatedDateRange(
  filter: Record<string, unknown>,
  input: { createdFrom?: Date; createdTo?: Date },
): void {
  if (input.createdFrom || input.createdTo) {
    filter.createdAt = {
      ...(input.createdFrom ? { $gte: input.createdFrom } : {}),
      ...(input.createdTo ? { $lte: input.createdTo } : {}),
    };
  }
}
