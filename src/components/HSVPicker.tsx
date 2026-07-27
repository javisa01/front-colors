import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import ColorPicker from "react-native-wheel-color-picker";

import type { HSVColor } from "@/types/challenge";
import { hexToHSV, normalizeHex } from "@/utils/color";

interface HSVPickerProps {
  color: string;
  onColorChange: (color: string, hsv: HSVColor) => void;
  thumbSize?: number;
  sliderSize?: number;
}

function HSVPicker({
  color,
  onColorChange,
  thumbSize = 24,
  sliderSize = 22,
}: HSVPickerProps): React.JSX.Element {
  const handleColorChange = useCallback(
    (nextColor: string): void => {
      const normalized = normalizeHex(nextColor);
      const nextHSV = hexToHSV(normalized);

      onColorChange(normalized, nextHSV);
    },
    [onColorChange],
  );

  return (
    <View style={styles.container}>
      <View style={styles.pickerCard}>
        <ColorPicker
          color={color}
          row
          noSnap
          thumbSize={thumbSize}
          sliderSize={sliderSize}
          gapSize={12}
          shadeWheelThumb
          shadeSliderThumb
          autoResetSlider
          useNativeDriver
          onColorChange={handleColorChange}
          onColorChangeComplete={handleColorChange}
        />
      </View>
    </View>
  );
}

export default memo(HSVPicker);

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  preview: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#27272A",
  },
  pickerCard: {
    width: "100%",
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
  },
});
