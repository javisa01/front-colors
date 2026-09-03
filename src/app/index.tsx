import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { DevTutorialCard } from "@/components/DevTutorialCard";
import { SettingsButton } from "@/components/SettingsButton";
import { Dial, HUB_RATIO } from "@/design/Dial";
import { Flame } from "@/design/Flame";
import { Icon } from "@/design/Icon";
import {
  Color,
  Duration,
  HAIRLINE,
  Radius,
  Space,
  Type,
} from "@/design/tokens";
import { t } from "@/i18n";
import { selectionTick } from "@/utils/haptics";
import { playTick } from "@/utils/sound";
import { landingSync, tutorialSeenSync, type LandingHint } from "@/utils/storage";

/**
 * La portada: el dial.
 *
 * ## Qué es esta pantalla
 *
 * La rueda de color es lo más característico del juego, y aquí no ilustra la
 * portada: **es** la portada. Se entra por su eje. La versión anterior era una
 * lista de dos filas —«Online» y «Offline»— que nombraba la tecnología en vez
 * del juego y daba el mismo peso a las dos cosas; esta tiene un solo sitio donde
 * mirar y una sola cosa que hacer.
 *
 * ## Los tres estados
 *
 * No son la misma pantalla con más o menos datos, porque el juego tampoco es el
 * mismo: **el reto diario vive dentro de un grupo**. Sin grupo no hay nada que
 * jugar en línea, y por eso la rueda está apagada hasta que hay con quién. El
 * gris no es un adorno de estado vacío: es lo que pasa.
 *
 *  - **Con grupos.** La rueda encendida y el eje abre el reto de hoy.
 *  - **Con cuenta, sin grupos.** Apagada; el eje lleva a crear un grupo.
 *  - **Sin cuenta.** Apagada; el eje lleva a entrar o registrarse.
 *
 * En los dos últimos, el eje es **la misma acción que enciende la rueda**, y la
 * animación del toque la enciende de verdad: la pantalla cumple su promesa
 * mientras navega.
 *
 * ## De dónde sale el estado
 *
 * De `landingSync()`, una pista que el área online deja escrita en el
 * almacenamiento offline. La raíz no monta `ClerkProvider` —esa es la frontera
 * que mantiene el modo offline sin red, ver `docs/ONLINE.md`—, así que no puede
 * preguntar por la sesión: solo leer lo último que se sabía.
 *
 * La pista puede estar caducada y da igual, porque aquí no se decide nada con
 * ella: solo a dónde apunta el eje. Quien comprueba la sesión de verdad es el
 * área online al entrar. Lo peor que puede pasar es un rótulo optimista durante
 * un toque.
 *
 * ## Por qué no usa `Screen`
 *
 * `Screen` da cabecera, título y scroll, y aquí sobran los tres: no hay título
 * —el titular ES el contenido—, la rueda tiene que desbordarse por los bordes, y
 * la fila de práctica va anclada al pie sin que nada haga scroll. Es la única
 * pantalla de la aplicación que se sale del molde, y se sale por eso.
 */

type State = "member" | "nogroups" | "guest";

function stateOf(hint: LandingHint): State {
  if (!hint.signedIn) {
    return "guest";
  }
  return hint.groups > 0 ? "member" : "nogroups";
}

/**
 * Cuánto mide la rueda respecto al ancho de la pantalla, y su tope.
 *
 * Es más ancha que el móvil a propósito: una rueda que cabe entera se lee como
 * un dibujo puesto encima, y una que se sale por los lados se lee como un
 * aparato del que solo ves el trozo que te hace falta. El tope evita que en una
 * tablet crezca hasta quedarse sin sitio para el titular.
 */
const DIAL_RATIO = 1.34;
const DIAL_MAX = 560;

/**
 * El tercer límite, y el que de verdad importa: **el hueco libre**.
 *
 * La rueda va centrada en lo que queda entre el titular y el pie, y se desborda
 * por igual arriba y abajo. Este factor es lo que mantiene la corona de color
 * **dentro** de ese hueco, para que el titular nunca acabe escrito encima.
 *
 * Sale de la geometría del degradado de `Ring`, no del ojo: el color se apaga
 * del todo al 96 % del radio y empieza a apagarse al 82 %, así que el último
 * color que se percibe está sobre el 90 %. Para que ese punto no salga del
 * hueco hace falta 0,9 · (tamaño / 2) ≤ hueco / 2, o sea tamaño ≤ 1,11 · hueco.
 *
 * Estuvo en 1,5 —calculado sobre el borde interior de la corona en vez del
 * exterior— y el resultado se veía a la primera: el color subía cuarenta píxeles
 * por encima y el subtítulo quedaba escrito sobre el cian.
 */
const DIAL_FREE_RATIO = 1.11;

/**
 * El velo del titular.
 *
 * `DIAL_FREE_RATIO` acota la rueda, pero no la aparta: la corona sigue asomando
 * por encima del hueco, y el subtítulo —tres líneas de texto normal, no de
 * display— se leía sobre color en movimiento. Un texto que hay que perseguir
 * porque el fondo gira debajo no es un problema de contraste medio: es que el
 * fondo **cambia**, y ninguna elección de color lo arregla.
 *
 * La respuesta no es una tarjeta. Esta pantalla tiene exactamente una superficie
 * —la fila del pie, translúcida porque flota sobre la rueda—, y meter una
 * segunda arriba convertiría la portada en una lista de dos cajas con la rueda
 * de fondo, que es justo la pantalla que esta sustituyó.
 *
 * Así que en vez de una caja, atmósfera: el lienzo se derrama desde arriba y se
 * disuelve justo por debajo del texto. No tiene canto, no tiene borde y no se
 * lee como un elemento; se lee como que la rueda **sale de debajo** del
 * titular. Es el mismo recurso que ya usa el aro suelto de la pantalla de
 * cuenta, y el mismo que emplea el propio `Ring` para desaparecer por su borde.
 *
 * Esto es lo que dura la disolución, en píxeles, contados desde el final del
 * bloque de texto: **su tope**, no su valor. Suficiente para que no se vea
 * dónde empieza, y corto para que no apague media rueda.
 *
 * El valor de verdad sale de `veilFade`, porque en una pantalla corta 132
 * píxeles se comen el eje: la rueda encoge, el eje sube, y el velo acababa
 * apagando «Jugar» —justo lo único que hay que pulsar—. Se vio a la primera en
 * una captura de 360 × 640.
 */
const VEIL_FADE = 132;

export default function LandingScreen(): ReactElement {
  const router = useRouter();
  const { width } = useWindowDimensions();

  /**
   * La primera vez, la portada cede el paso.
   *
   * El valor ya está leído —lo hace el layout raíz antes de retirar el splash—,
   * así que esto se resuelve en el primer render y no hay ningún fotograma de
   * portada antes del tutorial. Se vuelve a mirar al recuperar el foco porque el
   * botón de desarrollo puede borrar la marca.
   */
  const [seen, setSeen] = useState(tutorialSeenSync);

  /**
   * Y el estado se relee **también** al recuperar el foco: volver de crear el
   * primer grupo o de iniciar sesión tiene que encender la rueda, y esa vuelta
   * no remonta la pantalla.
   */
  const [hint, setHint] = useState<LandingHint>(landingSync);

  useFocusEffect(
    useCallback(() => {
      setSeen(tutorialSeenSync());
      setHint(landingSync());
    }, []),
  );

  const state = stateOf(hint);

  /**
   * El hueco entre el titular y el pie, medido. La rueda se dimensiona con él,
   * así que la portada se adapta a un móvil corto encogiendo la rueda en vez de
   * dejar que tape el texto.
   */
  const [freeHeight, setFreeHeight] = useState(0);

  const measureFree = useCallback((event: LayoutChangeEvent) => {
    setFreeHeight(event.nativeEvent.layout.height);
  }, []);

  /**
   * Dónde acaba el bloque de texto. El velo llega hasta ahí y a partir de ahí
   * se disuelve.
   *
   * Se mide en vez de fijarse porque el bloque no mide lo mismo en los tres
   * estados: el titular tiene dos líneas siempre, pero el subtítulo puede
   * ocupar dos o tres. Un alto escrito a mano protegería una de las tres
   * pantallas y dejaría las otras dos a medias.
   */
  const [headingBottom, setHeadingBottom] = useState(0);

  const measureHeading = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setHeadingBottom(y + height);
  }, []);

  const dialSize = Math.min(
    width * DIAL_RATIO,
    DIAL_MAX,
    freeHeight * DIAL_FREE_RATIO,
  );

  /**
   * Cuánto dura la disolución del velo, de verdad.
   *
   * El límite no es estético: **el velo se corta antes del eje**. Lo que hay
   * entre el final del texto y el borde de arriba del eje es medio hueco menos
   * el radio del eje, y esa es toda la distancia disponible. En una pantalla
   * alta sobra de largo y manda `VEIL_FADE`; en una corta manda el hueco, y el
   * velo se acaba justo donde empieza el eje —que es opaco, así que ahí la
   * disolución ya no se ve—.
   */
  const veilFade = Math.min(
    VEIL_FADE,
    Math.max(0, freeHeight / 2 - (dialSize * HUB_RATIO) / 2),
  );

  /**
   * Qué dice y a dónde va el eje, en un solo sitio.
   *
   * Encendida, el eje se queda **solo con el verbo**: ni rótulo ni apunte.
   * Alrededor está la rueda a todo color y arriba el titular dice qué toca
   * hoy, así que «el color de hoy» y «2 intentos» repetían lo que ya se ve y
   * lo que ya se ha leído — y lo hacían dentro del único objetivo táctil de la
   * pantalla, que es donde menos sitio hay para repetir nada.
   *
   * Apagada sí llevan los dos, y no es una excepción: ahí el eje no es
   * «jugar», es «esto se enciende así», y eso hay que decirlo.
   */
  const dial = useMemo(() => {
    switch (state) {
      case "member":
        return {
          kicker: undefined,
          label: t("dial.open.action"),
          note: undefined,
          hint: t("dial.open.hint"),
          href: "/online" as Href,
        };
      case "nogroups":
        return {
          kicker: t("dial.empty.kicker"),
          label: t("dial.empty.action"),
          note: t("dial.empty.note"),
          hint: t("dial.empty.hint"),
          href: "/online/groups" as Href,
        };
      case "guest":
        return {
          kicker: t("dial.guest.kicker"),
          label: t("dial.guest.action"),
          note: t("dial.guest.note"),
          hint: t("dial.guest.hint"),
          href: "/online/auth" as Href,
        };
    }
  }, [state]);

  const heading = useMemo(() => {
    switch (state) {
      case "member":
        return {
          label: t("dial.open.label"),
          title: t("dial.open.title"),
          body: t("dial.open.body"),
        };
      case "nogroups":
        return {
          label: t("dial.off.label"),
          title: t("dial.empty.title"),
          body: t("dial.empty.body"),
        };
      case "guest":
        return {
          label: t("dial.off.label"),
          title: t("dial.guest.title"),
          body: t("dial.guest.body"),
        };
    }
  }, [state]);

  const enterDial = useCallback(() => {
    router.push(dial.href);
  }, [dial.href, router]);

  const enterPractice = useCallback(() => {
    selectionTick();
    playTick();
    router.push("/offline");
  }, [router]);

  if (!seen) {
    return <Redirect href="/welcome" />;
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.shell}>
        {/*
          El velo. Va por delante de la rueda y por detrás del texto —de ahí el
          escalón de `zIndex`—, y no se pinta hasta que hay medida: con alto
          cero sería una banda de un píxel sobre el titular durante el primer
          fotograma. Ver `VEIL_FADE`.
        */}
        {headingBottom > 0 && veilFade > 0 ? (
          <LinearGradient
            pointerEvents="none"
            colors={[
              Color.surface.canvas,
              Color.surface.canvas,
              "transparent",
            ]}
            locations={[0, headingBottom / (headingBottom + veilFade), 1]}
            style={[styles.veil, { height: headingBottom + veilFade }]}
          />
        ) : null}

        <View style={styles.top}>
          <View style={styles.readout}>
            <Text style={[Type.label, styles.wordmark]}>
              {t("landing.badge")}
            </Text>

            {/*
              Solo se dice lo que se sabe de verdad. Sin cuenta no hay nada que
              contar aquí y no se rellena el hueco con una frase de relleno: la
              marca sola es una cabecera legítima.
            */}
            {state === "member" && hint.streak > 0 ? (
              <View style={styles.streak}>
                <Flame size={13} lit={hint.streakSecured} />
                <Text style={[Type.bodyStrong, styles.streakText]}>
                  {hint.streak === 1
                    ? t("dial.streakOne")
                    : t("dial.streak", { count: hint.streak })}
                </Text>
              </View>
            ) : null}

            {state === "nogroups" && hint.username.length > 0 ? (
              <Text style={[Type.caption, styles.who]}>
                {t("dial.noGroups", { name: hint.username })}
              </Text>
            ) : null}
          </View>

          <SettingsButton />
        </View>

        <Animated.View
          style={styles.heading}
          onLayout={measureHeading}
          entering={FadeIn.duration(Duration.base)}
        >
          <Text style={Type.label}>{heading.label}</Text>
          <Text style={[Type.display, styles.title]}>{heading.title}</Text>
          <Text style={[Type.body, styles.body]}>{heading.body}</Text>
        </Animated.View>

        {/*
          El hueco libre: se estira con lo que sobre y es lo que se mide. La
          rueda va centrada en él y se desborda por los cuatro lados, pero **sin
          empujar nada**, porque su tamaño sale de la caja y no al revés. Es lo
          que hace que la pantalla mida siempre lo mismo, no haya scroll y el pie
          esté de verdad anclado.
        */}
        <View style={styles.free} onLayout={measureFree} pointerEvents="box-none">
          {dialSize > 0 ? (
            <Dial
              size={dialSize}
              lit={state === "member"}
              kicker={dial.kicker}
              label={dial.label}
              note={dial.note}
              accessibilityHint={dial.hint}
              onPress={enterDial}
            />
          ) : null}
        </View>

        <View style={styles.footer}>
          {/* Solo en desarrollo. Ver `components/DevTutorialCard`. */}
          <DevTutorialCard />

          <Pressable
            onPress={enterPractice}
            style={({ pressed }) => [
              styles.practice,
              pressed && styles.practicePressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("dial.practice.title")}
            accessibilityHint={t("dial.practice.body")}
          >
            <View style={styles.practiceIcon}>
              <Icon name="palette" size={17} color={Color.spectrum.teal.icon} />
            </View>

            <View style={styles.practiceBody}>
              <Text style={Type.bodyStrong}>{t("dial.practice.title")}</Text>
              <Text style={[Type.caption, styles.practiceNote]}>
                {t("dial.practice.body")}
              </Text>
            </View>

            <Icon name="chevronRight" size={18} color={Color.text.faint} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Color.surface.canvas,
  },
  shell: {
    flex: 1,
    paddingHorizontal: Space.xl,
    paddingBottom: Space.lg,
    // Recorta la rueda contra el borde de la pantalla en vez de dejarla
    // desbordar el lienzo de la aplicación, que en web se veía flotando sobre
    // el fondo de la página.
    overflow: "hidden",
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: Space.md,
    // Por delante de la rueda: va antes en el árbol, así que sin esto la rueda
    // lo taparía en pantallas cortas.
    zIndex: 2,
  },
  readout: {
    gap: Space.sm,
    flexShrink: 1,
  },
  wordmark: {
    color: Color.text.secondary,
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  streakText: {
    color: Color.text.secondary,
  },
  who: {
    color: Color.text.muted,
  },
  veil: {
    position: "absolute",
    top: 0,
    // Sangrado hasta el borde de la pantalla: un hijo absoluto se coloca desde
    // el borde interior del relleno, así que sin esto quedarían dos franjas de
    // rueda sin velar a los lados del texto. `shell` recorta lo que sobra.
    left: -Space.xl,
    right: -Space.xl,
    // Por delante de la rueda —que no lleva `zIndex` y por tanto vale cero— y
    // por detrás de la cabecera y del titular, que van a dos.
    zIndex: 1,
  },
  heading: {
    marginTop: Space.xxxl,
    zIndex: 2,
  },
  title: {
    marginTop: Space.sm,
  },
  body: {
    marginTop: Space.md,
    maxWidth: 300,
  },
  free: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    // Por encima de la rueda: la fila de práctica flota sobre ella, y por eso
    // su fondo es translúcido.
    zIndex: 3,
  },
  practice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radius.lg,
    borderWidth: HAIRLINE,
    borderColor: Color.border.default,
    // La única superficie de la aplicación que deja ver lo que pasa por
    // debajo, junto con la pastilla de pestañas del online — y por el mismo
    // motivo: aquí, lo de debajo es la rueda.
    backgroundColor: Color.surface.floating,
  },
  practicePressed: {
    backgroundColor: Color.surface.interactive,
    borderColor: Color.border.strong,
  },
  practiceIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.spectrum.teal.surface,
    borderWidth: HAIRLINE,
    borderColor: Color.spectrum.teal.border,
  },
  practiceBody: {
    flex: 1,
    gap: Space.xxs,
  },
  practiceNote: {
    color: Color.text.muted,
  },
});
