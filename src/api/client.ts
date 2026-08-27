import { API_BASE_URL, API_PREFIX, REQUEST_TIMEOUT_MS } from "./config";
import { ApiError, type ApiErrorDetail } from "./errors";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** `false` para los endpoints públicos (ranking global, modos de partida). */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface ApiClientHooks {
  /**
   * Token de sesión de Clerk, o `null` si no hay sesión.
   *
   * Es asíncrono porque Clerk lo renueva solo cuando caduca; `skipCache` fuerza
   * uno recién emitido y es lo que se usa al reintentar tras un 401.
   */
  getToken: (options?: { skipCache?: boolean }) => Promise<string | null>;
  /** Se llama cuando el backend rechaza incluso un token recién pedido. */
  onSessionLost: () => void | Promise<void>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${API_BASE_URL}${API_PREFIX}${path}`;
  if (!query) {
    return url;
  }
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  return params.length > 0 ? `${url}?${params.join("&")}` : url;
}

/** Convierte el cuerpo `{ error: { code, message } }` del backend en ApiError. */
function toApiError(status: number, payload: unknown): ApiError {
  const body = payload as
    | { error?: { code?: string; message?: string; details?: unknown } }
    | undefined;
  const error = body?.error;
  return new ApiError(
    error?.code ?? "INTERNAL_ERROR",
    error?.message ?? `HTTP ${status}`,
    status,
    Array.isArray(error?.details)
      ? (error.details as ApiErrorDetail[])
      : undefined,
  );
}

export class ApiClient {
  constructor(private readonly hooks: ApiClientHooks) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { auth = true } = options;

    const first = await this.send<T>(path, options, auth ? {} : null);
    if (first.ok) {
      return first.data;
    }

    // 401 en una ruta autenticada: el token cacheado puede estar caducado o
    // haber sido revocado. Se pide uno nuevo a Clerk y se reintenta UNA vez.
    if (auth && first.error.status === 401) {
      const second = await this.send<T>(path, options, { skipCache: true });
      if (second.ok) {
        return second.data;
      }
      if (second.error.status === 401) {
        await this.hooks.onSessionLost();
      }
      throw second.error;
    }

    throw first.error;
  }

  /**
   * `tokenOptions` a `null` marca la petición como pública: ni se pide token.
   */
  private async send<T>(
    path: string,
    options: RequestOptions,
    tokenOptions: { skipCache?: boolean } | null,
  ): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Si quien llama trae su propio signal (desmontar la pantalla, por
    // ejemplo), lo encadenamos al nuestro.
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener("abort", abortFromCaller);

    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      if (tokenOptions) {
        const token = await this.hooks.getToken(tokenOptions);
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const response = await fetch(buildUrl(path, options.query), {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      // 204 y 205 no traen cuerpo.
      const isEmpty =
        response.status === 204 ||
        response.status === 205 ||
        response.headers.get("content-length") === "0";
      const payload = isEmpty ? null : await response.json().catch(() => null);

      if (!response.ok) {
        return { ok: false, error: toApiError(response.status, payload) };
      }
      return { ok: true, data: payload as T };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      // Igual que en `online/clerkErrors.ts`: aquí se pierde el error real (a
      // qué URL, por qué). En desarrollo se deja rastro con la URL de destino,
      // que es lo primero que hay que mirar cuando se prueba en un movil.
      if (__DEV__) {
        console.error(
          `[api] ${options.method ?? "GET"} ${buildUrl(path, options.query)} falló:`,
          error,
        );
      }
      return {
        ok: false,
        error: ApiError.network(
          aborted ? "La petición ha tardado demasiado" : "No se pudo conectar",
        ),
      };
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}
