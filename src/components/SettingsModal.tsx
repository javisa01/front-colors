import Slider from "@react-native-community/slider";
import { memo, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Modal from "react-native-modal";

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

interface SettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

function SettingsModalInner({ isVisible, onClose }: SettingsModalProps) {
  const [music, setMusic] = useState(getMusicVolume());
  const [sfx, setSfx] = useState(getSfxVolume());

  useEffect(() => {
    if (isVisible) {
      (async () => {
        setMusic(await loadMusicVolume());
        setSfx(await loadSfxVolume());
      })();
    }
  }, [isVisible]);

  const handleMusicChange = useCallback((v: number) => {
    setMusic(v);
    applyMusicVolume(v);
  }, []);

  const handleSfxChange = useCallback((v: number) => {
    setSfx(v);
    applySfxVolume(v);
  }, []);

  const handleClose = useCallback(() => {
    playTick();
    saveMusicVolume(music);
    saveSfxVolume(sfx);
    onClose();
  }, [music, sfx, onClose]);

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      backdropOpacity={0.6}
      animationIn="fadeIn"
      animationOut="fadeOut"
      useNativeDriverForBackdrop
      style={styles.modal}
    >
      <View style={styles.container}>
        <Text style={styles.title}>{t("settings.title")}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>🎵 {t("settings.music")}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={music}
            onValueChange={handleMusicChange}
            minimumTrackTintColor="#3B82F6"
            maximumTrackTintColor="#3F3F46"
            thumbTintColor="#FFFFFF"
          />
          <Text style={styles.pct}>{Math.round(music * 100)}%</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>🔊 {t("settings.sfx")}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={sfx}
            onValueChange={handleSfxChange}
            minimumTrackTintColor="#3B82F6"
            maximumTrackTintColor="#3F3F46"
            thumbTintColor="#FFFFFF"
          />
          <Text style={styles.pct}>{Math.round(sfx * 100)}%</Text>
        </View>

        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.closeBtn,
            pressed && styles.closeBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("settings.close")}
        >
          <Text style={styles.closeBtnText}>{t("settings.close")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export const SettingsModal = memo(SettingsModalInner);

const styles = StyleSheet.create({
  modal: {
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    maxWidth: 360,
    backgroundColor: "#18181B",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  label: {
    color: "#E4E4E7",
    fontSize: 14,
    fontWeight: "600",
    width: 80,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  pct: {
    color: "#A1A1AA",
    fontSize: 13,
    width: 40,
    textAlign: "right",
  },
  closeBtn: {
    marginTop: 8,
    backgroundColor: "#27272A",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
