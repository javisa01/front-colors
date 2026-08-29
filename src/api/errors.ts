import { t, type TranslationKey } from "@/i18n";

/**
 * Códigos de error del backend (ver `src/errors/appError.ts` allí).
 * La UI reacciona al `code`, nunca al texto: el mensaje del servidor viene en
 * español y la app está en tres idiomas.
 *
 * Los errores de credenciales y de alta de cuenta ya no salen de aquí: los
 * produce Clerk y los traduce `online/clerkErrors.ts`.
 */
export const ApiErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  USERNAME_ALREADY_USED: "USERNAME_ALREADY_USED",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  FRIENDSHIP_NOT_FOUND: "FRIENDSHIP_NOT_FOUND",
  FRIENDSHIP_ALREADY_EXISTS: "FRIENDSHIP_ALREADY_EXISTS",
  FRIENDSHIP_SELF: "FRIENDSHIP_SELF",
  FRIENDSHIP_NOT_PENDING: "FRIENDSHIP_NOT_PENDING",
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND",
  GROUP_CODE_INVALID: "GROUP_CODE_INVALID",
  ALREADY_MEMBER: "ALREADY_MEMBER",
  NOT_GROUP_OWNER: "NOT_GROUP_OWNER",
  SEASON_STILL_ACTIVE: "SEASON_STILL_ACTIVE",
  DAILY_CLOSED: "DAILY_CLOSED",
  NO_ATTEMPTS_LEFT: "NO_ATTEMPTS_LEFT",
  MESSAGE_TOO_LONG: "MESSAGE_TOO_LONG",
  /** Solo del cliente: no hubo respuesta (sin red, servidor caído, timeout). */
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export type ApiErrorCodeValue =
  (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export interface ApiErrorDetail {
  path: string;
  message: string;
  code?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(
    code: string,
    message: string,
    status: number,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static network(message: string): ApiError {
    return new ApiError(ApiErrorCode.NETWORK_ERROR, message, 0);
  }

  /** `true` si la sesión ya no sirve y hay que volver a la pantalla de acceso. */
  get isAuthFailure(): boolean {
    return (
      this.status === 401 ||
      this.code === ApiErrorCode.INVALID_TOKEN ||
      this.code === ApiErrorCode.TOKEN_EXPIRED ||
      this.code === ApiErrorCode.UNAUTHORIZED
    );
  }
}

/**
 * Mensaje traducido para enseñar al usuario. Los códigos que no tienen texto
 * propio caen en uno genérico; nunca se enseña el mensaje crudo del servidor.
 */
const MESSAGE_BY_CODE: Partial<Record<string, TranslationKey>> = {
  [ApiErrorCode.NETWORK_ERROR]: "online.error.network",
  [ApiErrorCode.USERNAME_ALREADY_USED]: "online.error.usernameUsed",
  [ApiErrorCode.USER_NOT_FOUND]: "online.error.userNotFound",
  [ApiErrorCode.RATE_LIMITED]: "online.error.rateLimited",
  [ApiErrorCode.VALIDATION_ERROR]: "online.error.validation",
  [ApiErrorCode.FRIENDSHIP_ALREADY_EXISTS]: "online.error.friendExists",
  [ApiErrorCode.FRIENDSHIP_SELF]: "online.error.friendSelf",
  [ApiErrorCode.FRIENDSHIP_NOT_FOUND]: "online.error.friendNotFound",
  [ApiErrorCode.UNAUTHORIZED]: "online.error.sessionExpired",
  [ApiErrorCode.TOKEN_EXPIRED]: "online.error.sessionExpired",
  [ApiErrorCode.INVALID_TOKEN]: "online.error.sessionExpired",
  [ApiErrorCode.GROUP_NOT_FOUND]: "online.error.groupNotFound",
  [ApiErrorCode.GROUP_CODE_INVALID]: "online.error.groupCodeInvalid",
  [ApiErrorCode.ALREADY_MEMBER]: "online.error.alreadyMember",
  [ApiErrorCode.NOT_GROUP_OWNER]: "online.error.notGroupOwner",
  [ApiErrorCode.SEASON_STILL_ACTIVE]: "online.error.seasonStillActive",
  [ApiErrorCode.DAILY_CLOSED]: "online.error.dailyClosed",
  [ApiErrorCode.NO_ATTEMPTS_LEFT]: "online.error.noAttemptsLeft",
};

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const key = MESSAGE_BY_CODE[error.code];
    if (key) {
      return t(key);
    }
    // Un error de validación trae el detalle del campo que falla; es más útil
    // que el genérico, aunque llegue en el idioma del servidor.
    const detail = error.details?.[0]?.message;
    if (detail) {
      return detail;
    }
  }
  return t("online.error.generic");
}
