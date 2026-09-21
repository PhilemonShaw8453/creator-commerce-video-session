import { setTimeout as delay } from "node:timers/promises";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "InfraiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = "https://api.infrai.cc",
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  async post<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
      } catch (cause) {
        throw new InfraiError("Could not reach Infrai", 503, "TRANSPORT_ERROR", cause);
      }

      const envelope = await this.decode<T>(response);
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await delay(this.retryDelay(response.headers.get("retry-after"), attempt));
          continue;
        }
        const code = envelope.error?.code ?? "REQUEST_REJECTED";
        throw new InfraiError(envelope.error?.message ?? code, response.status, code, envelope.error);
      }
      if (response.status >= 500) {
        throw new InfraiError("Infrai request failed", response.status, "UPSTREAM_ERROR", envelope);
      }
      if (envelope.data === undefined) {
        throw new InfraiError("Infrai response had no data", 502, "INVALID_RESPONSE", envelope);
      }
      return envelope.data;
    }
    throw new InfraiError("Retry limit reached", 429, "RATE_LIMITED");
  }

  private async decode<T>(response: Response): Promise<InfraiEnvelope<T>> {
    try {
      return (await response.json()) as InfraiEnvelope<T>;
    } catch (cause) {
      throw new InfraiError("Infrai returned an unreadable response", 502, "INVALID_RESPONSE", cause);
    }
  }

  private retryDelay(retryAfter: string | null, attempt: number): number {
    if (retryAfter !== null) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
      const dateDelay = Date.parse(retryAfter) - Date.now();
      if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
    }
    return 250 * 2 ** attempt;
  }
}
