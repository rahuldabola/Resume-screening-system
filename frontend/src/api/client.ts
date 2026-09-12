import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * Retry a read once when the request never reached the server.
 *
 * `err.response` being undefined means no HTTP response came back at all — a
 * dropped connection, a container swapping during a deploy, a cold start that
 * timed out. A single lost read otherwise blanks the whole page for someone
 * whose only mistake was loading it at the wrong second.
 *
 * Only GETs, and only once: a failed POST may well have been received and
 * applied, so replaying it could upload the same resume twice.
 */
apiClient.interceptors.response.use(undefined, async (err: AxiosError) => {
  const config = err.config as RetryableConfig | undefined;
  const isRead = config?.method?.toLowerCase() === 'get';

  if (!config || !isRead || config._retried || err.response) {
    return Promise.reject(err);
  }

  config._retried = true;
  await new Promise((resolve) => setTimeout(resolve, 600));
  return apiClient(config);
});

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    return err.response.data?.error || err.message;
  }
  return 'Something went wrong.';
}
