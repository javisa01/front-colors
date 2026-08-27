import Slider from "@react-native-community/slider";
import { memo, useCallback, useEffect, useState, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/design/Icon";
import { Sheet } from "@/design/Sheet";
import { Color, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
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
  setMusicVolume as saveMusicVolume,
  setSfxVolume as saveSfxVolume,
} from "@/utils/storage";

/**
 * Ajustes de audio.
 *
 * Sustituye a `SettingsModal`. Los cambios de fondo: llega como hoja inferior en
 * lugar de como diálogo centrado —es una preferencia, no una decisión que corte
 * la partida—, los emojis 🎵 y 🔊 pasan a ser iconos del set, y el porcentaje se
 * pinta con cifras de ancho fijo para que no baile mientras se arrastra.
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
  const percent = Math.round(value * 100);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.rowLabel}>
          <Icon name={icon} size={17} color={Color.text.secondary} />
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
        minimumTrackTintColor={Color.accent.default}
        maximumTrackTintColor={Color.surface.sunken}
        thumbTintColor={Color.text.primary}
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      />
    </View>
  );
}

function SettingsSheetInner({
  visible,
  onClose,
}: SettingsSheetProps): ReactElement {
  const [music, setMusic] = useState(getMusicVolume);
  const [sfx, setSfx] = useState(getSfxVolume);

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
   * Click de muestra **al soltar**, no en cada paso.
   *
   * Sin esto, ajustar el volumen de los efectos es la única preferencia de la
   * app cuyo resultado no se puede oír mientras se cambia. Pero dispararlo en
   * `onValueChange` daría veinte clicks por arrastre: sería volver a meter la
   * ráfaga de audio que se acaba de arreglar en `sound.ts`, esta vez a propósito.
   */
  const handleSfxCommit = useCallback(() => {
    playTick();
  }, []);

  const handleClose = useCallback(() => {
    void saveMusicVolume(music);
    void saveSfxVolume(sfx);
    onClose();
  }, [music, sfx, onClose]);

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      placement="bottom"
      title={t("settings.title")}
    >
      <VolumeRow
        icon="music"
        label={t("settings.music")}
        value={music}
        onChange={handleMusicChange}
      />
      <VolumeRow
        icon="volume"
        label={t("settings.sfx")}
        value={sfx}
        onChange={handleSfxChange}
        onCommit={handleSfxCommit}
      />
    </Sheet>
  );
}

export const SettingsSheet = memo(SettingsSheetInner);

const styles = StyleSheet.create({
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
});
