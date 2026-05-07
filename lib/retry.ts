// Generic retry-with-exponential-backoff for external API calls.
//
// Defaults: 3 attempts, base 1000ms — so the gaps between attempts are
// 1s and 2s (total worst-case ~3s on top of the API call latency).
// Callers can tune both, but the defaults are calibrated for the
// "occasionally fails on first attempt, succeeds on retry" pattern we
// see with Gemini cold starts and momentary rate-limit blips.
//
// Errors from the final attempt bubble up unchanged so existing
// fallback logic (e.g. Gemini → Claude in record-to-workflow) can
// classify them and route accordingly.
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
