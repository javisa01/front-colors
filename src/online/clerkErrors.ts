import { t, type TranslationKey } from "@/i18n";

/**
 * Traducción de los errores de Clerk.
 *
 * Clerk devuelve el mensaje en el idioma de la instancia (inglés por defecto)
 * y la app habla tres idiomas, así que aquí se hace lo mismo que en
 * `api/errors.ts` con el backend: se reacciona al `code`, nunca al texto.
 *
 * Los métodos de la API «future» (`signIn.password()`, `signUp.create()`...)
 * NO lanzan: devuelven `{ error }`. Por eso `describeClerkError` acepta
 * cualquier cosa y reconoce un error de Clerk por su forma.
 *
 * Referencia de códigos: https://clerk.com/docs/reference/errors/overview
 */

/** Campo del formulario al que pertenece el error, si es de un campo. */
export type ClerkField = "email" | "password" | "username" | "code";

interface CodedError {
  code: string;
  message?: string;
  longMessage?: string;
}

function isCodedError(value: unknown): value is CodedError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CodedError).code === "string"
  );
}

const MESSAGE_BY_CODE: Partial<Record<string, TranslationKey>> = {
  form_identifier_not_found: "online.error.credentials",
  form_password_incorrect: "online.error.credentials",
  strategy_for_user_invalid: "online.error.credentials",
  form_identifier_exists: "online.error.emailUsed",
  form_param_format_invalid: "online.error.validation",
  form_param_nil: "online.error.validation",
  form_password_pwned: "online.error.passwordPwned",
  form_password_length_too_short: "online.error.passwordWeak",
  form_password_not_strong_enough: "online.error.passwordWeak",
  form_code_incorrect: "online.error.codeIncorrect",
  verification_expired: "online.error.codeExpired",
  verification_failed: "online.error.codeExpired",
  verification_already_verified: "online.error.codeExpired",
  too_many_requests: "online.error.rateLimited",
  rate_limit_exceeded: "online.error.rateLimited",
  captcha_invalid: "online.error.captcha",
  captcha_unavailable: "online.error.captcha",
  session_exists: "online.error.sessionExists",
  identifier_already_signed_in: "online.error.sessionExists",
};

/**
 * A qué campo señalar. La API «future» entrega los errores de campo en el
 * `signal` del hook, pero eso solo se ve en el siguiente render; dentro del
 * manejador es más fiable deducirlo del propio código.
 */
const FIELD_BY_CODE: Partial<Record<string, ClerkField>> = {
  form_identifier_not_found: "email",
  form_identifier_exists: "email",
  form_password_incorrect: "password",
  form_password_pwned: "password",
  form_password_length_too_short: "password",
  form_password_not_strong_enough: "password",
  form_password_validation_failed: "password",
  form_username_invalid_length: "username",
  form_username_invalid_character: "username",
  form_code_incorrect: "code",
  verification_expired: "code",
  verification_failed: "code",
};

export interface ClerkFailure {
  message: string;
  /** `undefined` cuando el error no pertenece a ningún campo concreto. */
  field?: ClerkField;
}

/**
 * Vuelca lo que se pueda de un error desconocido. `JSON.stringify` de un
 * `Error` da `{}`, así que hay que sacar `name`/`message`/`cause` a mano.
 */
function rawDetail(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause === undefined ? "" : ` | cause: ${String(error.cause)}`;
    return `${error.name}: ${error.message}${cause}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function describeClerkError(error: unknown): ClerkFailure {
  if (!isCodedError(error)) {
    // Sin respuesta de Clerk: casi siempre es la red o una clave mal puesta.
    //
    // Esta rama descarta el error entero para quedarse con un texto genérico,
    // y sin esto un fallo de red, una clave de otra instancia y un dominio
    // inalcanzable son indistinguibles desde la UI. En desarrollo se vuelca
    // antes de perderlo; en release no se registra nada.
    if (__DEV__) {
      console.error("[clerk] error sin código:", rawDetail(error), error);
    }
    return { message: t("online.error.network") };
  }

  const key = MESSAGE_BY_CODE[error.code];

  return {
    message: key
      ? t(key)
      : (error.longMessage ?? error.message ?? t("online.error.generic")),
    field: FIELD_BY_CODE[error.code],
  };
}
