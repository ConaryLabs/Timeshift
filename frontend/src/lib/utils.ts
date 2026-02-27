import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { AxiosError } from "axios"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns true when an error is a 409 Conflict response from the backend,
 * indicating optimistic-locking failure (record modified since last fetch).
 */
export function isConflictError(error: unknown): boolean {
  return (
    error instanceof AxiosError &&
    error.response?.status === 409 &&
    error.response?.data?.error === 'conflict'
  )
}

/**
 * Returns true when the backend responded with a soft-limit 409 that the
 * caller can bypass by re-submitting with `force: true`.
 */
export function isSoftLimitError(error: unknown): boolean {
  return (
    error instanceof AxiosError &&
    error.response?.status === 409 &&
    error.response?.data?.soft_limit === true
  )
}
