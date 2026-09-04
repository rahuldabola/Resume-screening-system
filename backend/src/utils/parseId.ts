import { ApiError } from './ApiError';

/**
 * Turn a route parameter into a row id, or reject it.
 *
 * `Number(req.params.id)` alone maps "abc" to NaN and "1.5" to 1.5, both of
 * which then reach SQLite as a lookup that quietly matches nothing — a 404 for
 * a request that was actually malformed. This fails them as 400s instead.
 */
export function parseId(value: string | undefined, label = 'id'): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `Invalid ${label}: expected a positive integer.`);
  }

  return parsed;
}
