/**
 * Shared type definitions for common application entities and utilities.
 */

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export type Nullable<T> = T | null;
