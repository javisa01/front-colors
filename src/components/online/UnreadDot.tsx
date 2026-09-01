import { memo, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Color, Radius, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";

/**
 * El punto rojo: aquí hay algo que no has visto.
 *
 * Sale en tres sitios y en los tres significa lo mismo: la fila de un grupo con
 * avisos sin leer, la entrada al chat con mensajes nuevos, y el perfil de la
 * barra de pestañas con solicitudes de amistad esperando. Son tres cosas
 * distintas, pero para quien mira son una sola idea, y darles tres señales
 * obligaría a aprenderse tres.
 *
 * ## Por qué es rojo en una app que no usa el rojo
 *
 * El rojo de la paleta (`danger`) solo se gastaba en errores, y esto no lo es.
 * Se usa igualmente porque es el único color de la interfaz cuyo trabajo ya es
 * **interrumpir**, y porque un punto rojo sobre un nombre o sobre un icono es
 * un signo que nadie tiene que aprender: fuera de esta app significa esto. Un
 * punto violeta con el acento de la casa se leería como decoración, y el ámbar
 * de la racha ya significa otra cosa.
 *
 * ## Por qué a veces lleva número y a veces no
 *
 * Uno es «hay algo»: el punto lo dice entero y una cifra «1» encima no añade
 * nada. A partir de dos, cuántos son sí es información —una temporada renovada
 * no es lo mismo que cuatro, y una solicitud no es lo mismo que cinco— y
 * entonces el punto crece hasta ser una cápsula con su cifra. Es el mismo
 * elemento en dos tallas, no dos elementos.
 *
 * El aro del color del lienzo es lo que lo despega de lo que tenga detrás: sin
 * él, sobre una superficie clara el punto parece un fallo de pintado.
 */
function UnreadDotBase({
  count,
  label: given,
}: {
  count: number;
  /**
   * Qué anuncia un lector de pantalla.
   *
   * Por defecto habla de avisos, que es de lo que va en la lista de grupos; la
   * entrada al chat lo usa para lo suyo, que son mensajes. **`null` lo deja
   * mudo**, para cuando el punto va dentro de algo que ya lo cuenta: una
   * pestaña se anuncia entera, así que un punto que hablase por su cuenta
   * repetiría media frase.
   */
  label?: string | null;
}): ReactElement | null {
  if (count <= 0) {
    return null;
  }

  const spoken =
    given === null
      ? null
      : (given ??
        (count === 1
          ? t("online.groups.unreadOneA11y")
          : t("online.groups.unreadA11y", { count })));

  const voice =
    spoken == null
      ? ({
          accessibilityElementsHidden: true,
          importantForAccessibility: "no",
        } as const)
      : ({ accessible: true, accessibilityLabel: spoken } as const);

  if (count === 1) {
    return <View style={styles.dot} {...voice} />;
  }

  return (
    <View style={[styles.dot, styles.badge]} {...voice}>
      <Text style={styles.count}>{count > 9 ? "9+" : String(count)}</Text>
    </View>
  );
}

export const UnreadDot = memo(UnreadDotBase);

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: Color.danger.default,
    // El aro del lienzo, no un borde propio: separa el punto de la superficie
    // que tenga debajo sin inventarse un color más.
    borderWidth: 2,
    borderColor: Color.surface.canvas,
  },
  badge: {
    width: "auto",
    minWidth: 20,
    height: 18,
    paddingHorizontal: Space.xs + 1,
    alignItems: "center",
    justifyContent: "center",
  },
  count: {
    ...Type.label,
    // Casi negro sobre el rojo, como el resto de las tintas de la paleta: es lo
    // que hace que la cifra parezca impresa en el punto y no pegada encima.
    color: Color.danger.surface,
    letterSpacing: 0,
  },
});
