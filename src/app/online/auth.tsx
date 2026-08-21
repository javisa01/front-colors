import { useSignIn, useSignUp } from "@clerk/expo";
import { useSSO } from "@clerk/expo/experimental";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Card,
  ErrorBanner,
  Field,
  GhostButton,
  PrimaryButton,
} from "@/components/online/Controls";
import { OnlineScreen } from "@/components/online/Screen";
import { OnlinePalette } from "@/components/online/theme";
import { t } from "@/i18n";
import { describeClerkError, type ClerkField } from "@/online/clerkErrors";
import { playTick } from "@/utils/sound";

/**
 * Alta y acceso de jugadores, contra Clerk.
 *
 * La UI es la misma de siempre (pestañas, `Card`, `Field`) pero por debajo ya
 * no habla con `back-colors`: `useSignIn` / `useSignUp` crean la sesión en
 * Clerk y el backend solo verá después el token. Por eso aquí no se llama a
 * ningún endpoint propio.
 *
 * El nombre de jugador NO es el identificador de Clerk: viaja en
 * `unsafeMetadata` y lo adopta el backend al crear la ficha. Así el jugador
 * puede cambiarlo luego desde su perfil sin tocar su cuenta de Clerk.
 *
 * Se usa la API «future» de Clerk (`signIn.password()`, `signUp.create()`...),
 * que NO lanza excepciones: cada llamada devuelve `{ error }` y el estado del
 * intento se lee en `signIn.status` / `signUp.status`.
 */

// Cierra la ventana emergente de OAuth si la app se reabre a medias.
WebBrowser.maybeCompleteAuthSession();

type Step = "login" | "register" | "verify";

/** Mismas reglas que valida el backend, comprobadas antes de gastar una llamada. */
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const CODE_LENGTH = 6;

type FieldErrors = Partial<Record<ClerkField, string>>;

export default function AuthScreen(): ReactElement {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ssoBusy, setSsoBusy] = useState<string | null>(null);

  // Precalentar el navegador quita el parpadeo al abrir OAuth en Android.
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const clearMessages = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
    setNotice(null);
  }, []);

  const switchStep = useCallback(
    (next: Step) => {
      playTick();
      setStep(next);
      clearMessages();
    },
    [clearMessages],
  );

  /** Traduce el error de Clerk y lo coloca en su campo, o en el banner. */
  const showFailure = useCallback((error: unknown) => {
    const { message, field } = describeClerkError(error);
    if (field) {
      setFieldErrors({ [field]: message });
    } else {
      setFormError(message);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Validación local
  // -------------------------------------------------------------------------

  const validate = useCallback((): FieldErrors => {
    const errors: FieldErrors = {};

    if (step === "verify") {
      if (code.trim().length !== CODE_LENGTH) {
        errors.code = t("online.auth.error.code", { length: CODE_LENGTH });
      }
      return errors;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = t("online.auth.error.email");
    }

    if (step === "login") {
      if (password.length < 1) {
        errors.password = t("online.auth.error.passwordRequired");
      }
      return errors;
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      errors.username = t("online.auth.error.usernameLength");
    } else if (!USERNAME_PATTERN.test(cleanUsername)) {
      errors.username = t("online.auth.error.usernameChars");
    }

    if (password.length < MIN_PASSWORD) {
      errors.password = t("online.auth.error.passwordShort", {
        min: MIN_PASSWORD,
      });
    }

    return errors;
  }, [step, email, username, password, code]);

  // -------------------------------------------------------------------------
  // Flujos de Clerk
  // -------------------------------------------------------------------------

  const doLogin = useCallback(async () => {
    const { error } = await signIn.password({
      identifier: email.trim(),
      password,
    });
    if (error) {
      showFailure(error);
      return;
    }
    if (signIn.status !== "complete") {
      // Un paso adicional (2FA, por ejemplo) que esta app no tiene habilitado.
      setFormError(t("online.error.generic"));
      return;
    }
    // No navegamos aquí: al activar la sesión, la guarda de `_layout.tsx`
    // lleva sola al hub.
    await signIn.finalize();
  }, [signIn, email, password, showFailure]);

  const doRegister = useCallback(async () => {
    const { error } = await signUp.create({
      emailAddress: email.trim(),
      password,
      // El nombre de jugador no es una credencial de Clerk: lo recoge de aquí
      // el backend la primera vez que ve al usuario.
      unsafeMetadata: { username: username.trim() },
    });
    if (error) {
      showFailure(error);
      return;
    }

    // Si la instancia de Clerk no exige verificar el email, la cuenta ya está
    // lista y no hay paso de código que dar.
    if (signUp.status === "complete") {
      await signUp.finalize();
      return;
    }

    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) {
      showFailure(sent.error);
      return;
    }
    setStep("verify");
    setCode("");
  }, [signUp, email, password, username, showFailure]);

  const doVerify = useCallback(async () => {
    const { error } = await signUp.verifications.verifyEmailCode({
      code: code.trim(),
    });
    if (error) {
      showFailure(error);
      return;
    }
    if (signUp.status !== "complete") {
      setFormError(t("online.error.generic"));
      return;
    }
    await signUp.finalize();
  }, [signUp, code, showFailure]);

  const submit = useCallback(async () => {
    const errors = validate();
    setFieldErrors(errors);
    setFormError(null);
    setNotice(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setBusy(true);
    try {
      if (step === "login") {
        await doLogin();
      } else if (step === "register") {
        await doRegister();
      } else {
        await doVerify();
      }
    } catch (error) {
      showFailure(error);
    } finally {
      setBusy(false);
    }
  }, [validate, step, doLogin, doRegister, doVerify, showFailure]);

  const resendCode = useCallback(async () => {
    clearMessages();
    setBusy(true);
    try {
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) {
        showFailure(error);
        return;
      }
      setNotice(t("online.auth.verify.resent"));
    } finally {
      setBusy(false);
    }
  }, [signUp, clearMessages, showFailure]);

  const signInWith = useCallback(
    async (strategy: "oauth_google" | "oauth_apple") => {
      clearMessages();
      setSsoBusy(strategy);
      try {
        // `startSSOFlow` activa sola la sesión cuando el flujo se completa; si
        // vuelve sin `createdSessionId` es que el usuario cerró el navegador.
        await startSSOFlow({
          strategy,
          // Vuelve a la propia app tras el paso por el navegador. Depende del
          // `scheme` de `app.json` ("colorsapp").
          redirectUrl: Linking.createURL("/online"),
        });
      } catch (error) {
        showFailure(error);
      } finally {
        setSsoBusy(null);
      }
    },
    [startSSOFlow, clearMessages, showFailure],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const headings = useMemo(() => {
    if (step === "verify") {
      return {
        title: t("online.auth.verify.title"),
        subtitle: t("online.auth.verify.subtitle", { email: email.trim() }),
      };
    }
    return step === "login"
      ? {
          title: t("online.auth.title"),
          subtitle: t("online.auth.subtitle"),
        }
      : {
          title: t("online.auth.titleRegister"),
          subtitle: t("online.auth.subtitleRegister"),
        };
  }, [step, email]);

  const submitLabel =
    step === "verify"
      ? t("online.auth.verify.submit")
      : step === "login"
        ? t("online.auth.login")
        : t("online.auth.register");

  return (
    <OnlineScreen
      badge={t("online.auth.badge")}
      title={headings.title}
      subtitle={headings.subtitle}
      backTo="/"
      backLabel={t("common.back")}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {step === "verify" ? null : (
          <View style={styles.tabs}>
            <TabButton
              label={t("online.auth.login")}
              active={step === "login"}
              onPress={() => switchStep("login")}
            />
            <TabButton
              label={t("online.auth.register")}
              active={step === "register"}
              onPress={() => switchStep("register")}
            />
          </View>
        )}

        {formError ? <ErrorBanner message={formError} /> : null}
        {notice ? <Text style={styles.notice}>✅ {notice}</Text> : null}

        {step === "verify" ? (
          <Card>
            <Field
              label={t("online.auth.verify.code")}
              value={code}
              onChangeText={setCode}
              placeholder={t("online.auth.verify.codePlaceholder")}
              hint={t("online.auth.verify.hint")}
              error={fieldErrors.code}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <PrimaryButton
              label={submitLabel}
              onPress={submit}
              loading={busy}
            />

            <View style={styles.secondaryRow}>
              <GhostButton
                label={t("online.auth.verify.resend")}
                onPress={() => void resendCode()}
                disabled={busy}
                tone="accent"
              />
            </View>
            <View style={styles.secondaryRow}>
              <GhostButton
                label={t("online.auth.verify.back")}
                onPress={() => switchStep("register")}
                disabled={busy}
              />
            </View>
          </Card>
        ) : (
          <>
            <Card>
              {step === "register" ? (
                <Field
                  label={t("online.auth.username")}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={t("online.auth.usernamePlaceholder")}
                  hint={t("online.auth.usernameHint")}
                  error={fieldErrors.username}
                  autoComplete="username-new"
                  maxLength={24}
                />
              ) : null}

              <Field
                label={t("online.auth.email")}
                value={email}
                onChangeText={setEmail}
                placeholder={t("online.auth.emailPlaceholder")}
                hint={step === "login" ? t("online.auth.emailHint") : undefined}
                error={fieldErrors.email}
                keyboardType="email-address"
                autoComplete="email"
                maxLength={255}
              />

              <Field
                label={t("online.auth.password")}
                value={password}
                onChangeText={setPassword}
                placeholder={t("online.auth.passwordPlaceholder")}
                hint={
                  step === "register" ? t("online.auth.passwordHint") : undefined
                }
                error={fieldErrors.password}
                secure
                autoComplete={
                  step === "login" ? "current-password" : "new-password"
                }
                maxLength={128}
                returnKeyType="go"
                onSubmitEditing={submit}
              />

              <PrimaryButton
                label={submitLabel}
                onPress={submit}
                loading={busy}
                disabled={ssoBusy !== null}
              />
            </Card>

            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>{t("online.auth.or")}</Text>
              <View style={styles.separatorLine} />
            </View>

            <Card>
              <SocialButton
                label={t("online.auth.google")}
                emoji="🔵"
                loading={ssoBusy === "oauth_google"}
                disabled={busy || ssoBusy !== null}
                onPress={() => void signInWith("oauth_google")}
              />
              {/*
                Apple solo en iOS: es donde la App Store lo exige si hay otros
                proveedores sociales, y en Android su flujo web no aporta nada.
              */}
              {Platform.OS === "ios" ? (
                <View style={styles.secondaryRow}>
                  <SocialButton
                    label={t("online.auth.apple")}
                    emoji="🍎"
                    loading={ssoBusy === "oauth_apple"}
                    disabled={busy || ssoBusy !== null}
                    onPress={() => void signInWith("oauth_apple")}
                  />
                </View>
              ) : null}
            </Card>

            <Text style={styles.footer}>
              {step === "login"
                ? t("online.auth.switchToRegister")
                : t("online.auth.switchToLogin")}{" "}
              <Text
                style={styles.footerLink}
                onPress={() =>
                  switchStep(step === "login" ? "register" : "login")
                }
              >
                {step === "login"
                  ? t("online.auth.register")
                  : t("online.auth.login")}
              </Text>
            </Text>

            <Text style={styles.offlineNote}>{t("online.auth.offlineNote")}</Text>
          </>
        )}
      </KeyboardAvoidingView>
    </OnlineScreen>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && styles.tabPressed,
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SocialButton({
  label,
  emoji,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  emoji: string;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}): ReactElement {
  return (
    <Pressable
      onPress={() => {
        if (disabled) {
          return;
        }
        playTick();
        onPress();
      }}
      style={({ pressed }) => [
        styles.social,
        pressed && !disabled && styles.socialPressed,
        disabled && styles.socialDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
    >
      <Text style={styles.socialEmoji}>{emoji}</Text>
      <Text style={styles.socialText}>
        {loading ? t("online.auth.connecting") : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 16,
    backgroundColor: OnlinePalette.surface,
    borderWidth: 1,
    borderColor: OnlinePalette.border,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: OnlinePalette.accentSurface,
    borderWidth: 1,
    borderColor: OnlinePalette.accent,
  },
  tabPressed: {
    opacity: 0.8,
  },
  tabText: {
    color: OnlinePalette.textMuted,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "System",
  },
  tabTextActive: {
    color: OnlinePalette.text,
  },
  notice: {
    marginBottom: 14,
    color: "#6EE7B7",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "System",
  },
  secondaryRow: {
    marginTop: 10,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: OnlinePalette.border,
  },
  separatorText: {
    color: OnlinePalette.textDim,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: "System",
  },
  social: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OnlinePalette.border,
    backgroundColor: OnlinePalette.background,
    minHeight: 52,
  },
  socialPressed: {
    opacity: 0.75,
    borderColor: OnlinePalette.accent,
  },
  socialDisabled: {
    opacity: 0.45,
  },
  socialEmoji: {
    fontSize: 17,
  },
  socialText: {
    color: OnlinePalette.textSoft,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "System",
  },
  footer: {
    marginTop: 6,
    color: OnlinePalette.textFaint,
    fontSize: 13,
    textAlign: "center",
    fontFamily: "System",
  },
  footerLink: {
    color: OnlinePalette.accentSoft,
    fontWeight: "800",
  },
  offlineNote: {
    marginTop: 22,
    color: OnlinePalette.textDim,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontFamily: "System",
  },
});
