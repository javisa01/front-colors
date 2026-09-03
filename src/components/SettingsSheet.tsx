import Slider from "@react-native-community/slider";
import {
  memo,
  useCallback,
  useEffect,
  useState,
  type ReactElement,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Flag } from "@/design/Flag";
import { Toggle } from "@/design/Form";
import { Icon, type IconName } from "@/design/Icon";
import { Sheet } from "@/design/Sheet";
import { getThemeMode, setThemeMode, type ThemeMode, useColors, useThemedStyles } from "@/design/theme";
import {
  HIT_TARGET,
  Radius,
  Space,
  Type,
  type Palette,
} from "@/design/tokens";
import { getLocale, LOCALES, setLocale, t, type Locale } from "@/i18n";
import { selectionTick } from "@/utils/haptics";
import {
  setMusicVolume as applyMusicVolume,
  getMusicVolume,
} from "@/utils/music";
import {
  setSfxVolume as applySfxVolume,
  getSfxVolume,
  playTick,
} from "@/utils/sound";
import {
  getMusicVolume as loadMusicVolume,
  getSfxVolume as loadSfxVolume,
  setLanguage as saveLanguage,
  setMusicVolume as saveMusicVolume,
  setSfxVolume as saveSfxVolume,
  setThemeMode as saveThemeMode,
} from "@/utils/storage";

/**
 * Ajustes de la app: sonido, aspecto e idioma.
 *
 * Sustituye a `SettingsModal`. Los cambios de fondo: llega como hoja inferior en
 * lugar de como diálogo centrado —es una preferencia, no una decisión que corte
 * la partida—, los emojis 🎵 y 🔊 pasan a ser iconos del set, y el porcentaje se
 * pinta con cifras de ancho fijo para que no baile mientras se arrastra.
 *
 * ## Por qué el idioma se aplica al cerrar y no al tocarlo
 *
 * Cambiar de idioma **remonta la app entera** (ver `app/_layout.tsx`), y con
 * ella esta hoja. Aplicándolo en el `onPress`, el jugador vería desaparecer de
 * golpe el panel que estaba usando, sin haber pedido cerrarlo: un cambio de
 * preferencia que se lleva por delante la pantalla se lee como un fallo.
 *
 * Así que el toque solo mueve la selección aquí dentro —y la guarda en el
 * teléfono, que es lo que de verdad no puede perderse— y el idioma se aplica en
 * `handleClose`, cuando la hoja ya se iba. El texto de la propia hoja sigue en
 * el idioma anterior hasta ese momento; es correcto, no un descuido: mientras
 * estás eligiendo, la lista no debe moverse bajo el dedo.
 *
 * **El tema funciona exactamente igual, y por la misma razón**: aplicarlo
 * también remonta la app entera (comparte la `key` del navegador con el
 * idioma; ver `design/theme.tsx`). El interruptor mueve la selección y la
 * guarda; el tema de verdad cambia al cerrar. La pista debajo del interruptor
 * lo dice, para que nadie lo tome por un interruptor roto.
 */

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface VolumeRowProps {
  icon: IconName;
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Se dispara al soltar, no en cada paso. */
  onCommit?: (value: number) => void;
}

function VolumeRow({
  icon,
  label,
  value,
  onChange,
  onCommit,
}: VolumeRowProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const percent = Math.round(value * 100);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.rowLabel}>
          <Icon name={icon} size={17} color={colors.text.secondary} />
          <Text style={Type.bodyStrong}>{label}</Text>
        </View>
        <Text style={Type.metricSmall}>{percent}%</Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        step={0.05}
        value={value}
        onValueChange={onChange}
        onSlidingComplete={onCommit}
        minimumTrackTintColor={colors.accent.default}
        maximumTrackTintColor={colors.surface.sunken}
        thumbTintColor={colors.text.primary}
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      />
    </View>
  );
}

interface LanguageOptionProps {
  locale: Locale;
  label: string;
  selected: boolean;
  onSelect: (locale: Locale) => void;
}

function LanguageOption({
  locale,
  label,
  selected,
  onSelect,
}: LanguageOptionProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const handlePress = useCallback(() => {
    if (selected) {
      return;
    }
    selectionTick();
    playTick();
    onSelect(locale);
  }, [locale, onSelect, selected]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.language,
        selected && styles.languageSelected,
        pressed && !selected && styles.languagePressed,
      ]}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Flag locale={locale} />

      <Text
        style={[
          Type.bodyStrong,
          styles.languageLabel,
          selected && styles.languageLabelSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {/*
        El hueco de la marca se reserva siempre, esté o no seleccionada: sin él,
        la fila elegida sería 17 puntos más estrecha de contenido que las demás y
        el texto bailaría al cambiar de idioma.
      */}
      <View style={styles.check}>
        {selected ? (
          <Icon name="check" size={17} color={colors.accent.text} />
        ) : null}
      </View>
    </Pressable>
  );
}

function SettingsSheetInner({
  visible,
  onClose,
}: SettingsSheetProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const [music, setMusic] = useState(getMusicVolume);
  const [sfx, setSfx] = useState(getSfxVolume);
  const [language, setLanguage] = useState<Locale>(getLocale);
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode);

  /*
    El idioma se relee al abrir, y no solo al montar: esta hoja vive dentro de la
    cabecera y sobrevive a varias aperturas, así que sin esto conservaría la
    selección abandonada de la vez anterior.

    Se hace durante el render y no en un efecto —el mismo patrón que usa `Sheet`
    para montarse—: reajustar estado en un efecto provoca un render en cascada,
    que es justo lo que desaconseja la regla de React.
  */
  const [openedWith, setOpenedWith] = useState(visible);
  if (visible !== openedWith) {
    setOpenedWith(visible);
    if (visible) {
      setLanguage(getLocale());
      // El tema, por lo mismo que el idioma: la hoja sobrevive a varias
      // aperturas y sin releerlo conservaría una selección abandonada.
      setTheme(getThemeMode());
    }
  }

  useEffect(() => {
    if (!visible) {
      return;
    }

    let active = true;
    (async () => {
      const [storedMusic, storedSfx] = await Promise.all([
        loadMusicVolume(),
        loadSfxVolume(),
      ]);
      // Sin esta guarda, cerrar la hoja antes de que resuelva la lectura
      // reescribía el estado de un componente ya desmontado.
      if (active) {
        setMusic(storedMusic);
        setSfx(storedSfx);
      }
    })();

    return () => {
      active = false;
    };
  }, [visible]);

  const handleMusicChange = useCallback((next: number) => {
    setMusic(next);
    applyMusicVolume(next);
  }, []);

  const handleSfxChange = useCallback((next: number) => {
    setSfx(next);
    applySfxVolume(next);
  }, []);

  /**
   * Guardar al soltar, además de al cerrar.
   *
   * Los volúmenes se persistían solo en `handleClose`, y ahora esta hoja puede
   * desaparecer sin pasar por ahí: al cambiar de idioma, el árbol se remonta y
   * la hoja se va con él. Sin esto, el volumen recién ajustado se perdería
   * justo en esa combinación.
   */
  const handleMusicCommit = useCallback((next: number) => {
    void saveMusicVolume(next);
  }, []);

  /**
   * Click de muestra **al soltar**, no en cada paso.
   *
   * Sin esto, ajustar el volumen de los efectos es la única preferencia de la
   * app cuyo resultado no se puede oír mientras se cambia. Pero dispararlo en
   * `onValueChange` daría veinte clicks por arrastre: sería volver a meter la
   * ráfaga de audio que se acaba de arreglar en `sound.ts`, esta vez a propósito.
   */
  const handleSfxCommit = useCallback((next: number) => {
    void saveSfxVolume(next);
    playTick();
  }, []);

  const handleLanguageSelect = useCallback((next: Locale) => {
    setLanguage(next);
    // Se guarda ya, aunque se aplique al cerrar: si la app muere entre medias,
    // al volver a abrirla la elección sigue siendo la del jugador.
    void saveLanguage(next);
  }, []);

  const handleThemeToggle = useCallback((light: boolean) => {
    const next: ThemeMode = light ? "light" : "dark";
    setTheme(next);
    // Igual que el idioma: guardado al tocar, aplicado al cerrar.
    void saveThemeMode(next);
  }, []);

  const handleClose = useCallback(() => {
    void saveMusicVolume(music);
    void saveSfxVolume(sfx);
    // Ninguno de los dos hace nada si no ha cambiado, así que cerrar la hoja
    // sin tocar nada no remonta la app. El orden no importa: los dos acaban en
    // la misma `key` del navegador y el remontado es uno.
    setLocale(language);
    setThemeMode(theme);
    onClose();
  }, [music, sfx, language, theme, onClose]);

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      placement="bottom"
      title={t("settings.title")}
    >
      <Text style={[Type.label, styles.section]}>{t("settings.sound")}</Text>

      <VolumeRow
        icon="music"
        label={t("settings.music")}
        value={music}
        onChange={handleMusicChange}
        onCommit={handleMusicCommit}
      />
      <VolumeRow
        icon="volume"
        label={t("settings.sfx")}
        value={sfx}
        onChange={handleSfxChange}
        onCommit={handleSfxCommit}
      />

      <Text style={[Type.label, styles.section]}>
        {t("settings.appearance")}
      </Text>

      <Toggle
        icon="sun"
        label={t("settings.lightMode")}
        description={t("settings.themeHint")}
        value={theme === "light"}
        onValueChange={handleThemeToggle}
        style={styles.themeToggle}
      />

      <Text style={[Type.label, styles.section]}>{t("settings.language")}</Text>

      <View style={styles.languages} accessibilityRole="radiogroup">
        {LOCALES.map((option) => (
          <LanguageOption
            key={option.code}
            locale={option.code}
            label={option.label}
            selected={option.code === language}
            onSelect={handleLanguageSelect}
          />
        ))}
      </View>

      <Text style={[Type.caption, styles.hint]}>
        {t("settings.languageHint")}
      </Text>
    </Sheet>
  );
}

export const SettingsSheet = memo(SettingsSheetInner);

const createStyles = (c: Palette) =>
  StyleSheet.create({
  section: {
    marginBottom: Space.md,
  },
  row: {
    marginBottom: Space.lg,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space.xs,
  },
  rowLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  themeToggle: {
    // El mismo aire que deja una fila de volumen antes del siguiente epígrafe.
    marginBottom: Space.lg,
  },
  languages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.sm,
  },
  language: {
    // Dos por fila: un `flexBasis` por debajo de la mitad deja sitio al hueco
    // entre columnas, y `flexGrow` reparte lo que sobra. Con un idioma más, la
    // rejilla se reorganiza sola.
    flexGrow: 1,
    flexBasis: "45%",
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    minHeight: HIT_TARGET,
    paddingHorizontal: Space.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.surface.sunken,
  },
  languageSelected: {
    borderColor: c.accent.border,
    backgroundColor: c.accent.surface,
  },
  languagePressed: {
    backgroundColor: c.surface.interactive,
  },
  languageLabel: {
    flex: 1,
  },
  languageLabelSelected: {
    color: c.accent.text,
  },
  check: {
    width: 17,
    alignItems: "center",
  },
  hint: {
    marginTop: Space.md,
  },
  });
