import { memo, type ReactElement, type ReactNode } from "react";
import Svg, { Circle, Path } from "react-native-svg";

import { Color } from "@/design/tokens";

/**
 * Set de iconos de la aplicación.
 *
 * Sustituye a los 46 emojis que se usaban como iconografía. Un emoji lo dibuja
 * el sistema operativo, así que ⚙️ o ⚔️ se veían distintos en cada teléfono, no
 * heredaban el color del texto y no había forma de alinearlos ópticamente.
 *
 * Reglas del set, sin excepciones:
 *   - Rejilla de 24×24. Todo icono se dibuja dentro de ella.
 *   - Trazo de 1.75, terminaciones y uniones redondas, sin relleno salvo en los
 *     puntos macizos y en la estrella activa.
 *   - El icono hereda `color`, igual que el texto al que acompaña.
 *   - El dibujo mide `size`; el área táctil la pone `IconButton`, no el icono.
 */

export type IconName =
  // Navegación
  | "back"
  | "chevronRight"
  | "chevronLeft"
  | "home"
  | "close"
  // Acciones
  | "settings"
  | "gear"
  | "share"
  | "copy"
  | "send"
  | "retry"
  | "play"
  | "plus"
  | "minus"
  | "trash"
  | "check"
  | "search"
  | "edit"
  | "logOut"
  | "lock"
  // Modos en solitario
  | "zap"
  | "timer"
  | "calendar"
  | "palette"
  // Modos en grupo
  | "swords"
  | "flame"
  | "users"
  | "hourglass"
  // Conectividad
  | "globe"
  | "wifiOff"
  // Estado y datos
  | "trophy"
  | "alert"
  | "star"
  | "target"
  | "user"
  | "userPlus"
  | "message"
  | "bell"
  // Ajustes de audio
  | "music"
  | "volume"
  // Marcas de terceros
  | "google"
  | "apple";

interface IconProps {
  name: IconName;
  /** Tamaño del dibujo, no del área táctil. */
  size?: number;
  color?: string;
  /** Solo para `star`: la rellena para representar una estrella conseguida. */
  filled?: boolean;
}

/**
 * Cada icono es una función del color porque unos pocos trazos son macizos
 * (el punto de un signo de admisión, el centro de una diana) y deben teñirse
 * igual que el resto del dibujo.
 */
const ICONS: Record<IconName, (c: string, filled: boolean) => ReactNode> = {
  // -- Navegación ----------------------------------------------------------
  back: () => (
    <>
      <Path d="M19.5 12H4.5" />
      <Path d="M11 18.5 4.5 12 11 5.5" />
    </>
  ),
  chevronRight: () => <Path d="M9 4.5 16.5 12 9 19.5" />,
  chevronLeft: () => <Path d="M15 4.5 7.5 12 15 19.5" />,
  home: () => (
    <>
      <Path d="M3.5 10.2 12 3.5l8.5 6.7V20a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 20v-9.8Z" />
      <Path d="M9.5 21.5v-7h5v7" />
    </>
  ),
  close: () => (
    <>
      <Path d="M6 6l12 12" />
      <Path d="M18 6 6 18" />
    </>
  ),

  // -- Acciones ------------------------------------------------------------
  /**
   * Deslizadores, no un engranaje: el único ajuste de la app es el volumen de
   * música y efectos, así que el icono dice lo que hay dentro.
   */
  settings: () => (
    <>
      <Path d="M3.5 7.5h8.5" />
      <Path d="M17 7.5h3.5" />
      <Circle cx={14.5} cy={7.5} r={2.4} />
      <Path d="M3.5 16.5H7" />
      <Path d="M12 16.5h8.5" />
      <Circle cx={9.5} cy={16.5} r={2.4} />
    </>
  ),
  /**
   * Engranaje clásico, para los ajustes de una cosa concreta —un grupo, por
   * ejemplo—. No se solapa con `settings`: aquel son los deslizadores de la
   * app entera y los dos conviven en la misma cabecera.
   */
  gear: () => (
    <>
      <Circle cx={12} cy={12} r={6.6} />
      <Circle cx={12} cy={12} r={2.9} />
      <Path d="M18.6 12h2" />
      <Path d="M5.4 12h-2" />
      <Path d="M12 5.4v-2" />
      <Path d="M12 18.6v2" />
      <Path d="m16.67 7.33 1.41-1.41" />
      <Path d="M7.33 7.33 5.92 5.92" />
      <Path d="m7.33 16.67-1.41 1.41" />
      <Path d="m16.67 16.67 1.41 1.41" />
    </>
  ),
  share: () => (
    <>
      <Path d="M12 15.5V3" />
      <Path d="M8 7l4-4 4 4" />
      <Path d="M5 12v7.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </>
  ),
  /**
   * Dos hojas, la de detrás asomando por arriba y por la izquierda.
   *
   * Solo asoma por dos lados y no por los cuatro: con el marco completo las
   * dos siluetas quedan concéntricas y el dibujo se lee como un rectángulo
   * dentro de otro. Lo que dice «copia» es el desplazamiento.
   */
  copy: () => (
    <>
      <Path d="M9.5 8.5h9a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 8 19v-9a1.5 1.5 0 0 1 1.5-1.5Z" />
      <Path d="M5 15.5A1.5 1.5 0 0 1 3.5 14V5A1.5 1.5 0 0 1 5 3.5h9A1.5 1.5 0 0 1 15.5 5" />
    </>
  ),
  /**
   * Avión de papel, con el pliegue marcado. El pliegue no es adorno: sin él la
   * silueta se lee como una flecha, y una flecha ya significa otra cosa en esta
   * aplicación.
   */
  send: () => (
    <>
      <Path d="M21 3.6 2.8 10.4l7.1 2.9 2.9 7.1L21 3.6Z" />
      <Path d="M21 3.6 9.9 13.3" />
    </>
  ),
  retry: () => (
    <>
      <Path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <Path d="M3.5 4v4.5H8" />
    </>
  ),
  play: () => <Path d="M7.5 4.8 19 12 7.5 19.2V4.8Z" />,
  plus: () => (
    <>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </>
  ),
  minus: () => <Path d="M5 12h14" />,
  trash: () => (
    <>
      <Path d="M4 6.5h16" />
      <Path d="M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <Path d="M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5" />
      <Path d="M10.5 10.5v6.5" />
      <Path d="M13.5 10.5v6.5" />
    </>
  ),
  check: () => <Path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  search: () => (
    <>
      <Circle cx={10.8} cy={10.8} r={7.3} />
      <Path d="M16.2 16.2 21 21" />
    </>
  ),
  edit: () => (
    <>
      <Path d="M4 20h4.2L19.4 8.8a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8V20Z" />
      <Path d="M14.4 6.4 17.6 9.6" />
    </>
  ),
  logOut: () => (
    <>
      <Path d="M9.5 3.5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h3.5" />
      <Path d="M14.5 16.5 19.5 12l-5-4.5" />
      <Path d="M19.5 12H9" />
    </>
  ),
  lock: () => (
    <>
      <Path d="M5.5 10.5h13a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5V12a1.5 1.5 0 0 1 1.5-1.5Z" />
      <Path d="M7.8 10.5V7.4a4.2 4.2 0 0 1 8.4 0v3.1" />
    </>
  ),

  // -- Modos en solitario --------------------------------------------------
  zap: () => <Path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />,
  timer: () => (
    <>
      <Circle cx={12} cy={13.5} r={8} />
      <Path d="M12 9.5v4.2l2.6 1.8" />
      <Path d="M9.5 2.5h5" />
    </>
  ),
  calendar: () => (
    <>
      <Path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-12Z" />
      <Path d="M4.5 10h15" />
      <Path d="M8.5 2.5v4" />
      <Path d="M15.5 2.5v4" />
    </>
  ),
  palette: (c) => (
    <>
      <Path d="M12 21a9 9 0 1 1 9-9c0 2.1-1.6 3.3-3.3 3.3h-1.9a1.9 1.9 0 0 0-1.3 3.3A1.9 1.9 0 0 1 12 21Z" />
      <Circle cx={7.6} cy={13} r={1.15} fill={c} stroke="none" />
      <Circle cx={9.3} cy={8.6} r={1.15} fill={c} stroke="none" />
      <Circle cx={14.2} cy={7.6} r={1.15} fill={c} stroke="none" />
      <Circle cx={17.2} cy={10.8} r={1.15} fill={c} stroke="none" />
    </>
  ),

  // -- Modos en grupo ------------------------------------------------------
  swords: () => (
    <>
      <Path d="M18.5 3.5 8.5 13.5" />
      <Path d="M5.5 3.5 15.5 13.5" />
      <Path d="M6.6 12.4 9.6 15.4" />
      <Path d="M17.4 12.4 14.4 15.4" />
      <Path d="M8.1 16.9 5.1 19.9" />
      <Path d="M15.9 16.9 18.9 19.9" />
    </>
  ),
  flame: () => (
    <Path d="M12 21.5c3.7 0 6.6-2.9 6.6-6.5 0-4.3-3.8-6.6-4.4-10.7-1.6 1.3-2.5 3-2.5 5 0 1.1-1 1.9-1.9 1.3-.8-.5-1.1-1.3-1.1-2.3-1.6 2.2-3.3 4.6-3.3 7.7 0 3.6 2.9 6.5 6.6 6.5Z" />
  ),
  users: () => (
    <>
      <Circle cx={9} cy={8} r={3.6} />
      <Path d="M2.8 20.5c0-3.4 2.8-6.2 6.2-6.2s6.2 2.8 6.2 6.2" />
      <Path d="M16 5.3a3.6 3.6 0 0 1 0 5.4" />
      <Path d="M17.6 14.6c2.1.8 3.6 2.8 3.6 5.4" />
    </>
  ),
  hourglass: () => (
    <>
      <Path d="M6.5 2.5h11" />
      <Path d="M6.5 21.5h11" />
      <Path d="M8 2.5v4.1c0 1.6 1.2 2.7 2.4 3.6L12 11.4l1.6-1.2c1.2-.9 2.4-2 2.4-3.6V2.5" />
      <Path d="M8 21.5v-4.1c0-1.6 1.2-2.7 2.4-3.6L12 12.6l1.6 1.2c1.2.9 2.4 2 2.4 3.6v4.1" />
    </>
  ),

  // -- Conectividad --------------------------------------------------------
  globe: () => (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M3.2 12h17.6" />
      <Path d="M12 3c2.4 2.7 3.7 5.8 3.7 9s-1.3 6.3-3.7 9c-2.4-2.7-3.7-5.8-3.7-9S9.6 5.7 12 3Z" />
    </>
  ),
  wifiOff: (c) => (
    <>
      <Path d="M2.5 2.5 21.5 21.5" />
      <Path d="M2 8.6A15.6 15.6 0 0 1 7.4 5.4" />
      <Path d="M22 8.6a15.6 15.6 0 0 0-9.4-3.3" />
      <Path d="M5.4 12.4a10.4 10.4 0 0 1 3.7-2.3" />
      <Path d="M18.6 12.4a10.4 10.4 0 0 0-3-2.1" />
      <Path d="M9 16.2a5.2 5.2 0 0 1 5-.3" />
      <Circle cx={12} cy={19.8} r={1.05} fill={c} stroke="none" />
    </>
  ),

  // -- Estado y datos ------------------------------------------------------
  trophy: () => (
    <>
      <Path d="M7.5 3.5h9V9a4.5 4.5 0 0 1-9 0V3.5Z" />
      <Path d="M7.5 5.5H5.2A2.2 2.2 0 0 0 5.2 10h1.6" />
      <Path d="M16.5 5.5h2.3a2.2 2.2 0 0 1 0 4.5h-1.6" />
      <Path d="M12 13.5v3.8" />
      <Path d="M8.2 20.5h7.6" />
    </>
  ),
  /** El bocadillo del chat. La misma silueta que la entrada al chat del grupo. */
  message: () => (
    <Path d="M20.5 12.3c0 3.9-3.8 7.1-8.5 7.1-.98 0-1.93-.14-2.8-.4L3.5 20.8l1.6-3.6a6.8 6.8 0 0 1-1.6-4.9c0-3.9 3.8-7.1 8.5-7.1s8.5 3.2 8.5 7.1Z" />
  ),
  bell: () => (
    <>
      <Path d="M6.2 10.2a5.8 5.8 0 0 1 11.6 0v3.6l1.6 3H4.6l1.6-3v-3.6Z" />
      <Path d="M10 20a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  alert: (c) => (
    <>
      <Path d="M12 3.4 22 20.6H2L12 3.4Z" />
      <Path d="M12 10v4.4" />
      <Circle cx={12} cy={17.6} r={1.05} fill={c} stroke="none" />
    </>
  ),
  star: (c, filled) => (
    <Path
      d="M12 2.6 14.9 8.5 21.4 9.4 16.7 14 17.8 20.5 12 17.4 6.2 20.5 7.3 14 2.6 9.4 9.1 8.5 12 2.6Z"
      fill={filled ? c : "none"}
    />
  ),
  target: (c) => (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={4.8} />
      <Circle cx={12} cy={12} r={1.4} fill={c} stroke="none" />
    </>
  ),
  user: () => (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4.5 20.5c0-3.6 3.4-6.4 7.5-6.4s7.5 2.8 7.5 6.4" />
    </>
  ),
  userPlus: () => (
    <>
      <Circle cx={9.5} cy={8} r={4} />
      <Path d="M2.5 20.5c0-3.6 3.1-6.4 7-6.4 1.2 0 2.3.3 3.3.8" />
      <Path d="M18 14.5v6" />
      <Path d="M15 17.5h6" />
    </>
  ),

  // -- Ajustes de audio ----------------------------------------------------
  music: () => (
    <>
      <Path d="M9 17.5V4.8l11-2v12.7" />
      <Circle cx={6} cy={17.5} r={3} />
      <Circle cx={17} cy={15.5} r={3} />
    </>
  ),
  volume: () => (
    <>
      <Path d="M11 4.5 6.4 8.4H3v7.2h3.4L11 19.5V4.5Z" />
      <Path d="M15.4 9.2a4 4 0 0 1 0 5.6" />
      <Path d="M18.3 6.3a8 8 0 0 1 0 11.4" />
    </>
  ),

  // -- Marcas de terceros --------------------------------------------------
  /**
   * Las dos únicas excepciones a las reglas del set: son marcas registradas y
   * deben ser reconocibles, así que se dibujan con su forma real en lugar de
   * reinterpretarlas. Van monocromas y heredan el color como el resto, que es
   * lo que ambas compañías permiten cuando el botón no usa su fondo de marca.
   */
  google: () => (
    <>
      <Path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <Path d="M12 12h8" />
    </>
  ),
  apple: (c) => (
    <>
      <Path
        d="M16.6 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.2 1 8.3.7 1 1.5 2.1 2.6 2.1 1-.1 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4 0 0-2.2-.8-2.2-3.3Z"
        fill={c}
        stroke="none"
      />
      <Path
        d="M14.7 6.3c.6-.7.9-1.7.8-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.1Z"
        fill={c}
        stroke="none"
      />
    </>
  ),
};

function IconBase({
  name,
  size = 20,
  color = Color.text.secondary,
  filled = false,
}: IconProps): ReactElement {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name](color, filled)}
    </Svg>
  );
}

export const Icon = memo(IconBase);
