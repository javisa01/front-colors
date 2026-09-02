import { useSignIn, useSignUp } from "@clerk/expo";
import { useSSO } from "@clerk/expo/experimental";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import Animated, { FadeIn } from "react-native-reanimated";

import { Button } from "@/design/Button";
import { DialRing } from "@/design/Dial";
import { ErrorBanner } from "@/design/Feedback";
import { Field, Notice, OrDivider, SegmentedControl } from "@/design/Form";
import { Card, Screen } from "@/design/Layout";
import { Color, Duration, SECTION_TONE, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import { describeClerkError, type ClerkField } from "@/online/clerkErrors";

/**
 * Alta y acceso de jugadores, contra Clerk.
 *
 * La lógica es la misma de siempre: `useSignIn` / `useSignUp` crean la sesión en
 * Clerk y el backend solo verá después el token, así que aquí no se llama a
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

/**
 * El aro de la portada, en el mismo sitio donde estaba.
 *
 * Al pulsar el eje del dial la rueda se enciende y arranca; esta pantalla es
 * donde aterriza ese gesto, asi que trae la misma rueda, ya encendida y en la
 * misma esquina de la pantalla: desbordada por abajo. El formulario aparece por
 * encima de ella. Las dos pantallas comparten anclaje, y eso es lo que hace que
 * se lean como un solo movimiento y no como dos sitios distintos.
 *
 * ## Por que abajo y no arriba
 *
 * Arriba se probo primero y no funciona, y el motivo no es de gusto: la mitad
 * superior es el unico hueco sin superficies de esta pantalla, y es justamente
 * donde viven la flecha de volver, el rotulo de seccion, el titular y su
 * subtitulo. Cualquier aro con color suficiente para verse dejaba el subtitulo
 * —texto secundario, gris medio— por debajo de 3:1 de contraste. Y taparlo
 * hasta que el texto se leyera lo dejaba invisible, que era peor: color que no
 * se ve no es color, es coste.
 *
 * Abajo no hay ese problema. Ahi solo cae la nota de que el modo offline sigue
 * funcionando, y esa se protege con un velo corto.
 *
 * ## La excepcion cromatica
 *
 * Cinco rellenos saturados a la vez van en contra de la regla de la casa —lo
 * unico saturado en pantalla debe ser el color del juego—, y aqui valen por el
 * mismo motivo que valen en el estado vacio del online: en esta pantalla no hay
 * color de juego. No hay reto, ni logo, ni muestra que comparar, asi que el aro
 * no le quita protagonismo a nada.
 */
const RING_RATIO = 1.45;
const RING_MAX = 600;
/** Cuanto del aro queda por debajo del borde. Solo asoma su arco de arriba. */
const RING_HIDDEN = 0.8;
/**
 * A media luz larga. A plena opacidad el aro vuelve a ser el objeto principal,
 * y aqui lo principal es un formulario.
 */
const RING_OPACITY = 0.72;
/**
 * Velo sobre el BORDE SUPERIOR del arco, no sobre el inferior.
 *
 * La pantalla hace scroll sobre un fondo fijo, asi que no hay forma de saber
 * que texto acabara encima del arco: hoy es la nota del pie, con el teclado
 * abierto puede ser otra cosa. El velo entra en lienzo opaco por donde el arco
 * empieza y se abre hacia abajo, de modo que lo que caiga sobre el se lee
 * siempre y el color solo llena la franja del borde, donde ya no hay nada.
 */
const SCRIM_HEIGHT = 210;

export default function AuthScreen(): ReactElement {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { width } = useWindowDimensions();

  const ringSize = Math.min(width * RING_RATIO, RING_MAX);

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

  // El sonido y el háptico los pone el control que se ha pulsado, no esta
  // función: es la regla del sistema de diseño y evita el doble «tic».
  const switchStep = useCallback(
    (next: Step) => {
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
    <Screen
      eyebrow={t("online.auth.badge")}
      title={headings.title}
      subtitle={headings.subtitle}
      backTo="/"
      backdrop={
        <View style={styles.ring} pointerEvents="none">
          <View style={styles.ringInk}>
            <DialRing
              size={ringSize}
              style={{ marginBottom: -ringSize * RING_HIDDEN }}
            />
          </View>
          <LinearGradient
            colors={[Color.surface.canvas, "transparent"]}
            locations={[0, 0.62]}
            style={styles.scrim}
            pointerEvents="none"
          />
        </View>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {step === "verify" ? null : (
          <SegmentedControl
            options={[
              { value: "login", label: t("online.auth.login") },
              { value: "register", label: t("online.auth.register") },
            ]}
            value={step}
            onChange={switchStep}
            tone={SECTION_TONE.account}
          />
        )}

        {formError ? <ErrorBanner message={formError} /> : null}

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

            {notice ? <Notice message={notice} /> : null}

            <View style={styles.actions}>
              <Button
                label={submitLabel}
                tone={SECTION_TONE.account}
                onPress={submit}
                loading={busy}
              />
              <Button
                label={t("online.auth.verify.resend")}
                variant="secondary"
                size="md"
                onPress={() => void resendCode()}
                disabled={busy}
              />
              <Button
                label={t("online.auth.verify.back")}
                variant="ghost"
                size="md"
                onPress={() => switchStep("register")}
                disabled={busy}
              />
            </View>
          </Card>
        ) : (
          <>
            <Card tone={SECTION_TONE.account}>
              {step === "register" ? (
                <Field
                  label={t("online.auth.username")}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={t("online.auth.usernamePlaceholder")}
                  hint={t("online.auth.usernameHint")}
                  error={fieldErrors.username}
                  icon="user"
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
                icon="lock"
                secure
                autoComplete={
                  step === "login" ? "current-password" : "new-password"
                }
                maxLength={128}
                returnKeyType="go"
                onSubmitEditing={submit}
              />

              <Button
                label={submitLabel}
                tone={SECTION_TONE.account}
                onPress={submit}
                loading={busy}
                disabled={ssoBusy !== null}
              />
            </Card>

            <OrDivider label={t("online.auth.or")} />

            {/*
              Los accesos con Google y Apple entran un poco después que la
              tarjeta: son la vía rápida, y verlos aparecer detrás del
              formulario es lo que dice que son una alternativa a lo de arriba
              y no un paso siguiente.
            */}
            <Animated.View
              style={styles.social}
              entering={FadeIn.delay(120).duration(Duration.base)}
            >
              <Button
                label={
                  ssoBusy === "oauth_google"
                    ? t("online.auth.connecting")
                    : t("online.auth.google")
                }
                icon="google"
                variant="secondary"
                loading={ssoBusy === "oauth_google"}
                disabled={busy || ssoBusy !== null}
                onPress={() => void signInWith("oauth_google")}
              />
              {/*
                Apple solo en iOS: es donde la App Store lo exige si hay otros
                proveedores sociales, y en Android su flujo web no aporta nada.
              */}
              {Platform.OS === "ios" ? (
                <Button
                  label={
                    ssoBusy === "oauth_apple"
                      ? t("online.auth.connecting")
                      : t("online.auth.apple")
                  }
                  icon="apple"
                  variant="secondary"
                  loading={ssoBusy === "oauth_apple"}
                  disabled={busy || ssoBusy !== null}
                  onPress={() => void signInWith("oauth_apple")}
                />
              ) : null}
            </Animated.View>

            <View style={styles.footer}>
              <Text style={Type.caption}>
                {step === "login"
                  ? t("online.auth.switchToRegister")
                  : t("online.auth.switchToLogin")}
              </Text>
              <Button
                label={
                  step === "login"
                    ? t("online.auth.register")
                    : t("online.auth.login")
                }
                variant="ghost"
                size="md"
                fullWidth={false}
                onPress={() =>
                  switchStep(step === "login" ? "register" : "login")
                }
              />
            </View>

            <Text style={[Type.caption, styles.offlineNote]}>
              {t("online.auth.offlineNote")}
            </Text>
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ring: {
    // El aro se centra en horizontal y se baja con un margen negativo, asi que
    // de la rueda entera solo entra en pantalla su arco de arriba.
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  ringInk: {
    opacity: RING_OPACITY,
  },
  scrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCRIM_HEIGHT,
  },
  actions: {
    gap: Space.sm,
    marginTop: Space.sm,
  },
  social: {
    gap: Space.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.xs,
    marginTop: Space.lg,
  },
  offlineNote: {
    marginTop: Space.lg,
    textAlign: "center",
    color: Color.text.faint,
  },
});
