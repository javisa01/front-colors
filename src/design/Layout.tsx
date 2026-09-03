import { useRouter, type Href } from "expo-router";
import {
  memo,
  useCallback,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconButton, usePressScale } from "@/design/Button";
import { Icon, type IconName } from "@/design/Icon";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  CONTENT_MAX_WIDTH,
  Duration,
  Elevation,
  HIT_SLOP,
  HIT_TARGET,
  Radius,
  Space,
  TABLET_BREAKPOINT,
  Type,
  type Palette,
  type SpectrumTone,
} from "@/design/tokens";
import { t } from "@/i18n";
import { selectionTick } from "@/utils/haptics";
import { playTick } from "@/utils/sound";

/**
 * Primitivas de disposición.
 *
 * `Screen` es el armazón de TODAS las pantallas. Antes existían dos: el que
 * `index.tsx` y `offline.tsx` escribían a mano y `components/online/Screen.tsx`
 * para la mitad online, cada uno con sus propios márgenes, su propio tamaño de
 * título y su propio enlace de vuelta. Con dos armazones, las dos mitades de la
 * app no podían dejar de divergir.
 */

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------

interface ScreenProps {
  /** Título principal. Uno por pantalla. */
  title?: string;
  subtitle?: string;
  /** Kicker en versalitas sobre el título. */
  eyebrow?: string;
  /**
   * Activa el botón de volver; sin él no se pinta cabecera de navegación.
   *
   * No es a dónde va la flecha —eso lo decide el historial, ver `ScreenBase`—
   * sino el destino de reserva para cuando no hay historial al que volver:
   * entrada por enlace directo, o una recarga en web.
   */
  backTo?: Href;
  /**
   * Sustituye lo que hace la flecha. Con esto, `backTo` solo sirve ya para
   * decir que hay flecha.
   *
   * La regla de la casa es que la flecha haga lo mismo que el «atrás» del
   * sistema, y para las pantallas que viven en una **pila** es la correcta.
   *
   * ## Dónde no vale, y por qué
   *
   * Todo el área online cuelga de un navegador de **pestañas**, y ahí
   * `router.back()` no significa «la pantalla anterior»: el `TabRouter` de
   * React Navigation trae `backBehavior: "firstRoute"` de fábrica, así que
   * volver desde cualquier pestaña lleva a la **primera** —el menú de Hoy— sin
   * mirar de dónde vienes. Las pantallas profundas de esa zona están
   * declaradas también como pestañas (con `href: null`, para quedar fuera de
   * la barra pero seguir siendo navegables), así que les pasa lo mismo: los
   * ajustes de un grupo volvían al menú en vez de a su grupo.
   *
   * No se arregla poniendo `backBehavior: "history"` en las pestañas porque
   * eso cambiaría también el botón «atrás» de Android en toda el área, y
   * porque estas pantallas no quieren el historial: quieren **su sitio**. Los
   * ajustes de un grupo vuelven a ese grupo, el chat de un grupo vuelve a ese
   * grupo y el tablero del reto vuelve al grupo donde puntúa. Eso es un
   * destino, no una pila.
   *
   * La otra excepción es de otra clase: **la pantalla de cuenta** se abre desde
   * la portada, pero vive dentro de estas mismas pestañas, y sin sesión la
   * primera está prohibida — la guarda del layout devuelve a la cuenta al
   * instante y la flecha parece no hacer nada.
   */
  onBack?: () => void;
  /** Acción al vuelo a la derecha de la barra superior (ajustes, contador...). */
  headerAction?: ReactNode;
  /**
   * Acción pegada al **título**, no a la barra.
   *
   * La diferencia importa: lo que va en la barra es de la aplicación —los
   * ajustes están ahí en todas las pantallas—, y lo que va aquí es de **esta**
   * cosa que se está mirando. El lápiz que abre los ajustes de un grupo tiene
   * que salir junto al nombre de ese grupo, porque es lo que edita.
   */
  titleAction?: ReactNode;
  /**
   * Capa decorativa detrás del contenido, dentro del lienzo. Va aquí y no
   * envolviendo a `Screen` desde fuera porque el `SafeAreaView` pinta el fondo
   * opaco de la aplicación y taparía cualquier cosa que quedase por detrás.
   */
  backdrop?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Desactiva el scroll cuando el contenido debe caber en una pantalla. */
  scrollable?: boolean;
  /**
   * Mando de la lista, para quien necesite moverla desde fuera.
   *
   * Hoy lo usa una sola cosa: el recorrido con foco de la pantalla de práctica,
   * que tiene que subir hasta lo que va a señalar antes de medirlo. Va como
   * `ref` opcional y no como un `scrollTo` propio a propósito — `Screen` no
   * tiene por qué inventarse una API de scroll cuando la de `ScrollView` ya
   * existe y todo el mundo la conoce.
   */
  scrollRef?: RefObject<ScrollView | null>;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

function ScreenBase({
  title,
  subtitle,
  eyebrow,
  backTo,
  onBack,
  headerAction,
  titleAction,
  backdrop,
  onRefresh,
  refreshing = false,
  scrollable = true,
  scrollRef,
  children,
  contentStyle,
}: ScreenProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const router = useRouter();
  const hasHeaderBar = backTo != null || headerAction != null;

  const body = (
    <View
      style={[
        styles.shell,
        // Sin barra superior no hay nada que separe el título del borde de la
        // pantalla y el texto queda pegado arriba. Se compensa con el mismo
        // alto que ocupa la barra, para que el título caiga a la misma altura
        // que en las pantallas que sí la llevan y no dé un salto al navegar.
        !hasHeaderBar && styles.shellBare,
        contentStyle,
      ]}
    >
      {hasHeaderBar ? (
        <View style={styles.headerBar}>
          {backTo != null ? (
            <IconButton
              name="back"
              /**
               * La flecha dispara la MISMA acción que el botón «atrás» del
               * sistema, no una navegación a un destino propio.
               *
               * Antes hacía `replace(backTo)`, que sustituye la entrada actual
               * del historial por el destino: la pila quedaba con el destino
               * dos veces y el «atrás» del móvil o del navegador parecía no
               * hacer nada, porque devolvía a la pantalla recién abierta.
               *
               * Apuntar la flecha a un destino declarado tampoco basta: aunque
               * no ensucie la pila, un salto de dos pantallas y uno de una
               * siguen dejando al jugador en sitios distintos. `back()` es
               * literalmente la acción del botón nativo, así que las dos no
               * pueden discrepar.
               *
               * `backTo` queda como reserva para cuando no hay historial —un
               * enlace directo, una recarga en web—, donde `back()` no tendría
               * a dónde ir y la flecha se quedaría muerta.
               *
               * `onBack` se salta todo esto, y por qué hace falta está en su
               * nota de arriba.
               */
              onPress={() =>
                onBack != null
                  ? onBack()
                  : router.canGoBack()
                    ? router.back()
                    : router.dismissTo(backTo)
              }
              accessibilityLabel={t("a11y.back")}
              // Sangrado negativo: el objetivo táctil de 44pt es mayor que el
              // dibujo, así que sin esto el icono quedaría ópticamente metido
              // hacia dentro respecto al título que tiene debajo.
              style={styles.headerBarLeading}
            />
          ) : (
            <View style={styles.headerBarSpacer} />
          )}
          {headerAction}
        </View>
      ) : null}

      {title != null ? (
        <View style={styles.header}>
          {eyebrow != null ? (
            <Text style={[Type.label, styles.eyebrow]}>{eyebrow}</Text>
          ) : null}
          {titleAction != null ? (
            <View style={styles.titleRow}>
              {/*
                El título encoge y la acción no: con un nombre largo se recorta
                el texto antes que empujar el lápiz fuera de la pantalla.
              */}
              <Text style={[Type.display, styles.titleGrow]} numberOfLines={2}>
                {title}
              </Text>
              {titleAction}
            </View>
          ) : (
            <Text style={Type.display}>{title}</Text>
          )}
          {subtitle != null ? (
            <Text style={[Type.body, styles.subtitle]}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}

      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/*
        La capa decorativa va recortada al lienzo. Los orbes se colocan
        desbordados por las esquinas a propósito, y sin este recorte se pintan
        fuera de los límites de la aplicación: en web se veía el trozo que
        sobresale flotando sobre el fondo blanco de la página en cuanto el
        scroll rebotaba.
      */}
      {backdrop != null ? (
        <View style={styles.backdrop} pointerEvents="none">
          {backdrop}
        </View>
      ) : null}

      {scrollable ? (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh != null ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.text.muted}
                colors={[colors.accent.default]}
                progressBackgroundColor={colors.surface.raised}
              />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export const Screen = memo(ScreenBase);

// ---------------------------------------------------------------------------
// Superficies
// ---------------------------------------------------------------------------

interface CardProps {
  children: ReactNode;
  /** `flat` quita la sombra: para tarjetas dentro de otra superficie. */
  variant?: "raised" | "flat";
  /**
   * A qué sección pertenece la tarjeta. Ver la nota de `CardBase`.
   *
   * Sin tono, la tarjeta es la gris de siempre — y esa sigue siendo la opción
   * por defecto, porque la mayoría de las tarjetas no pertenecen a nada.
   */
  tone?: SpectrumTone;
  /** Retardo de la animación de entrada, en ms. */
  enterDelay?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Tarjeta.
 *
 * La entrada es un fundido corto y sin desplazamiento. Las pantallas usaban
 * `FadeInDown` escalonado con retardos de hasta 460 ms, así que abrir el menú de
 * modos obligaba a mirar cómo se montaba la lista antes de poder tocarla. Un
 * fundido de 260 ms comunica «esto acaba de aparecer» sin cobrar peaje.
 *
 * ## El canto de color
 *
 * Con `tone`, la tarjeta lleva un canto de 2 px del pigmento de su sección en el
 * borde superior. Nace de un problema real: apiladas, todas las pantallas eran
 * la misma tarjeta gris repetida, y nada decía si lo que estabas mirando era del
 * ranking o de tu cuenta.
 *
 * Es un canto y no un relleno teñido —ni un borde completo— por dos motivos. El
 * relleno bajaría el contraste de todo el texto que va encima, que es
 * exactamente lo que una tarjeta no puede permitirse; y el borde entero
 * convertiría cada tarjeta en un aviso de colores, que es el aspecto de
 * plantilla del que veníamos huyendo. Un canto arriba se lee como el borde
 * pintado de una muestra de color, que es el material de este juego.
 *
 * **Con avaricia.** El tono va en la tarjeta que abre una sección, no en las
 * cinco de la pantalla: si todas lo llevan, deja de distinguir nada y vuelve a
 * ser decoración.
 */
function CardBase({
  children,
  variant = "raised",
  tone,
  enterDelay,
  style,
}: CardProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const content = (
    <View
      style={[
        styles.card,
        variant === "raised" && Elevation.raised,
        tone != null && {
          borderTopWidth: 2,
          borderTopColor: colors.spectrum[tone].pigment,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (enterDelay == null) {
    return content;
  }

  return (
    <Animated.View entering={FadeIn.delay(enterDelay).duration(Duration.base)}>
      {content}
    </Animated.View>
  );
}

export const Card = memo(CardBase);

/** Encabezado de sección: rótulo en versalitas y pista opcional. */
function SectionHeaderBase({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.sectionHeader}>
      <Text style={Type.label}>{title}</Text>
      {hint != null ? (
        <Text style={[Type.caption, styles.sectionHint]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const SectionHeader = memo(SectionHeaderBase);

// ---------------------------------------------------------------------------
// Fila de opción
// ---------------------------------------------------------------------------

interface OptionRowProps {
  icon: IconName;
  /**
   * Tinte del icono. Identifica la fila dentro de su lista; sin él, el icono va
   * neutro. Un mismo destino lleva siempre el mismo tono en toda la app.
   */
  tone?: SpectrumTone;
  title: string;
  description?: string;
  /** Elemento a la derecha del título: un récord, un estado. */
  badge?: ReactNode;
  /**
   * Lo que anuncia un lector de pantalla. Por defecto, el título.
   *
   * Existe porque la fila se anuncia como un solo elemento: lo que se cuele en
   * el galón —un punto rojo de avisos, por ejemplo— se ve pero no se oye. Quien
   * ponga ahí algo que signifique alguna cosa tiene que decirlo también aquí.
   */
  accessibilityLabel?: string;
  /** Nota bajo la descripción, en tono apagado. */
  note?: string;
  onPress: () => void;
  disabled?: boolean;
  enterDelay?: number;
}

/**
 * Fila pulsable de selección: icono, título, descripción y galón.
 *
 * Estaba escrita a mano diez veces entre la portada y el menú offline, cada una
 * con su degradado de color propio detrás del emoji. Aquí el icono va sobre una
 * superficie neutra: en una lista, diez cuadros de colores distintos compiten
 * entre sí y ninguno significa nada — el color solo aparece cuando la fila está
 * pulsada, para señalar cuál se ha tocado.
 */
function OptionRowBase({
  icon,
  tone,
  title,
  description,
  badge,
  accessibilityLabel,
  note,
  onPress,
  disabled = false,
  enterDelay,
}: OptionRowProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const press = usePressScale(0.985);

  const handlePress = useCallback((): void => {
    if (disabled) {
      return;
    }
    selectionTick();
    playTick();
    onPress();
  }, [disabled, onPress]);

  const row = (
    <Animated.View style={press.style}>
      <Pressable
        onPress={handlePress}
        onPressIn={disabled ? undefined : press.onPressIn}
        onPressOut={disabled ? undefined : press.onPressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.optionRow,
          pressed && !disabled && styles.optionRowPressed,
          disabled && styles.optionRowDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={description}
        accessibilityState={{ disabled }}
      >
        <View
          style={[
            styles.optionIcon,
            tone != null && {
              backgroundColor: colors.spectrum[tone].surface,
              borderColor: colors.spectrum[tone].border,
            },
          ]}
        >
          <Icon
            name={icon}
            size={20}
            color={tone != null ? colors.spectrum[tone].icon : colors.text.primary}
          />
        </View>

        <View style={styles.optionBody}>
          {/*
            La fila envuelve: cuando el título y el galón no caben juntos —un
            récord de cinco cifras en una pantalla estrecha—, el galón baja una
            línea en lugar de empujar al título fuera de la vista. El título no
            encoge (`flexShrink` a cero por defecto), así que siempre gana él el
            sitio; el `maxWidth` es lo que hace que se recorte con puntos
            suspensivos en vez de desbordar cuando no cabe ni él solo.
          */}
          <View style={styles.optionTitleRow}>
            <Text style={[Type.heading, styles.optionTitle]} numberOfLines={1}>
              {title}
            </Text>
            {badge}
          </View>
          {description != null ? (
            <Text style={[Type.caption, styles.optionDescription]}>
              {description}
            </Text>
          ) : null}
          {note != null ? (
            <Text style={[Type.caption, styles.optionNote]}>{note}</Text>
          ) : null}
        </View>

        <Icon name="chevronRight" size={18} color={colors.text.faint} />
      </Pressable>
    </Animated.View>
  );

  if (enterDelay == null) {
    return row;
  }

  return (
    <Animated.View entering={FadeIn.delay(enterDelay).duration(Duration.base)}>
      {row}
    </Animated.View>
  );
}

export const OptionRow = memo(OptionRowBase);

// ---------------------------------------------------------------------------
// Enlace de texto
// ---------------------------------------------------------------------------

/**
 * Un enlace, no un botón.
 *
 * Existe porque «ver todo» no es una acción del mismo peso que «jugar» o
 * «crear grupo», y con un botón lo parecía: en una pantalla con tres botones a
 * ancho completo, el cuarto que dice «ver todos mis grupos» compite con el que
 * de verdad importa. Un enlace centrado, en el acento y con la flecha detrás,
 * se lee como «hay más de esto por aquí» y no como una decisión.
 *
 * Conserva el área táctil de 44 puntos aunque el texto sea de 13: el tamaño de
 * lo que se ve y el de lo que se toca son cosas distintas.
 */
function TextLinkBase({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const handlePress = useCallback((): void => {
    selectionTick();
    playTick();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.textLink, pressed && styles.textLinkPressed]}
      hitSlop={HIT_SLOP}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <Text style={[Type.bodyStrong, styles.textLinkLabel]}>{label}</Text>
      <Icon name="chevronRight" size={16} color={colors.accent.text} />
    </Pressable>
  );
}

export const TextLink = memo(TextLinkBase);

// ---------------------------------------------------------------------------
// Panel de aviso
// ---------------------------------------------------------------------------

interface NoticePanelProps {
  title: string;
  /** Una línea por punto. Van con viñeta; el orden es el que se pasa. */
  items: string[];
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/**
 * Un aviso: reglas, condiciones, «cómo funciona».
 *
 * **No es una `Card`, y eso es justo lo que tiene que verse.** Una tarjeta es
 * contenido —lo que hay hoy, cuánto llevas, quién va ganando—; esto es la letra
 * que explica ese contenido. Puestas del mismo modo, las dos cosas compiten y
 * la explicación se lee con el mismo peso que los datos.
 *
 * Se separa por cuatro cosas a la vez, porque una sola no basta para que se lea
 * como otra categoría:
 *
 *  - **Riel de color a la izquierda.** Es la forma que ningún otro elemento de
 *    la app usa, y es la que se reconoce de lejos sin leer nada.
 *  - **Fondo teñido y hundido** en lugar de la superficie elevada de una
 *    tarjeta: se hunde en la pantalla en vez de flotar sobre ella.
 *  - **Radio menor y sin sombra**: una tarjeta se levanta, un aviso no.
 *  - **Icono y título en el acento**, que aquí significa «esto es información
 *    sobre el resto», no un estado que haya que atender.
 */
function NoticePanelBase({
  title,
  items,
  icon = "alert",
  style,
}: NoticePanelProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  return (
    <View style={[styles.notice, style]} accessibilityRole="summary">
      <Icon name={icon} size={18} color={colors.accent.text} />

      <View style={styles.noticeBody}>
        <Text style={[Type.label, styles.noticeTitle]}>{title}</Text>

        {items.map((item, index) => (
          <View key={index} style={styles.noticeItem}>
            {/* Un punto dibujado y no un «•» del texto: así queda alineado con
                la primera línea aunque el punto envuelva a dos. */}
            <View style={styles.noticeBullet} />
            <Text style={[Type.caption, styles.noticeText]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export const NoticePanel = memo(NoticePanelBase);

/** Línea divisoria de 1px. */
export const Divider = memo(function Divider({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.divider, style]} />;
});

/** `true` en pantallas anchas. Un único punto de corte para toda la app. */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.surface.canvas,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  shell: {
    flexGrow: 1,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxxl,
  },
  shellBare: {
    // El mismo alto que `headerBar`: es lo que hace que el título esté a la
    // misma altura lleve barra o no.
    paddingTop: Space.huge,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: Space.huge,
  },
  headerBarLeading: {
    marginLeft: -Space.md,
  },
  headerBarSpacer: {
    width: 1,
  },
  header: {
    marginBottom: Space.xxl,
  },
  eyebrow: {
    marginBottom: Space.sm,
    // El único texto acentuado de la app. Es una sola línea en versalitas, así
    // que el color se nota sin pelearse con el título que tiene debajo, y como
    // aparece en la cabecera de todas las pantallas, es lo que hace que la
    // interfaz no se lea como puro blanco y negro. Los encabezados de sección
    // siguen en gris a propósito: si también fuesen de color, dejaría de
    // señalar nada.
    color: c.accent.text,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  titleGrow: {
    flex: 1,
  },
  subtitle: {
    marginTop: Space.sm,
    maxWidth: 460,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Space.lg,
    backgroundColor: c.surface.raised,
    borderWidth: 1,
    borderColor: c.border.default,
  },
  sectionHeader: {
    marginBottom: Space.md,
  },
  textLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.xs,
    // El texto es de 13 puntos; el objetivo táctil, de 44. Ver `HIT_TARGET`.
    minHeight: HIT_TARGET,
  },
  textLinkPressed: {
    opacity: 0.6,
  },
  textLinkLabel: {
    color: c.accent.text,
  },
  notice: {
    flexDirection: "row",
    gap: Space.md,
    padding: Space.lg,
    // Radio menor que el de una tarjeta y sin sombra: se hunde, no flota.
    borderRadius: Radius.md,
    backgroundColor: c.accent.surface,
    // El riel. Va solo a la izquierda a propósito: un borde completo lo
    // devolvería al aspecto de tarjeta, que es de lo que hay que separarlo.
    borderLeftWidth: 3,
    borderLeftColor: c.accent.default,
  },
  noticeBody: {
    flex: 1,
    gap: Space.sm,
  },
  noticeTitle: {
    color: c.accent.text,
  },
  noticeItem: {
    flexDirection: "row",
    gap: Space.sm,
  },
  noticeBullet: {
    width: 3,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: c.text.muted,
    // Centrado ópticamente con la primera línea de texto (13/18).
    marginTop: 8,
  },
  noticeText: {
    flex: 1,
  },
  sectionHint: {
    marginTop: Space.xs,
  },
  divider: {
    height: 1,
    backgroundColor: c.border.subtle,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.lg,
    backgroundColor: c.surface.raised,
    borderWidth: 1,
    borderColor: c.border.default,
  },
  optionRowPressed: {
    backgroundColor: c.surface.interactive,
    borderColor: c.accent.border,
  },
  optionRowDisabled: {
    opacity: 0.45,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface.sunken,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  optionBody: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Space.sm,
  },
  optionTitle: {
    maxWidth: "100%",
  },
  optionDescription: {
    marginTop: Space.xxs,
  },
  optionNote: {
    marginTop: Space.sm,
    color: c.text.faint,
  },
  });
