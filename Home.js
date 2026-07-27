import { useMemo, useState } from "react";
import {
    Image,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import convert from "color-convert";
import ColorPicker from "react-native-wheel-color-picker";

const TARGET = {
  h: 358,
  s: 100,
  v: 96,
};

const TOLERANCE = {
  h: 5,
  s: 5,
  v: 5,
};

function hueDistance(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

export default function App() {
  const [color, setColor] = useState("#F40009");
  const [result, setResult] = useState("");

  const hsv = useMemo(() => {
    const rgb = convert.hex.rgb(color.replace("#", ""));
    const [h, s, v] = convert.rgb.hsv(rgb);

    return { h, s, v };
  }, [color]);

  const validate = () => {
    const ok =
      hueDistance(hsv.h, TARGET.h) <= TOLERANCE.h &&
      Math.abs(hsv.s - TARGET.s) <= TOLERANCE.s &&
      Math.abs(hsv.v - TARGET.v) <= TOLERANCE.v;

    if (ok) {
      setResult("🎉 ¡Correcto! Has encontrado el rojo de Coca-Cola.");
    } else {
      setResult("❌ Sigue probando.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Adivina el color de Coca-Cola</Text>

      <View style={styles.logoContainer}>
        <Image
          source={require("./assets/mask.png")}
          style={[
            styles.logo,
            {
              position: "absolute",
              tintColor: color,
            },
          ]}
        />

        <Image source={require("./assets/base.png")} style={styles.logo} />
      </View>

      <ColorPicker
        color={color}
        thumbSize={30}
        sliderSize={30}
        noSnap={true}
        row={false}
        onColorChangeComplete={(c) => setColor(c)}
      />

      <View style={styles.info}>
        <Text style={styles.hex}>HEX: {color.toUpperCase()}</Text>

        <Text style={styles.hsv}>Tono: {hsv.h}°</Text>

        <Text style={styles.hsv}>Saturación: {hsv.s}%</Text>

        <Text style={styles.hsv}>Brillo: {hsv.v}%</Text>
      </View>

      <Pressable style={styles.button} onPress={validate}>
        <Text style={styles.buttonText}>Comprobar</Text>
      </Pressable>

      {!!result && <Text style={styles.result}>{result}</Text>}

      {result.startsWith("🎉") && (
        <Text style={styles.target}>
          Color correcto:
          {"\n"}
          Tono: 358°
          {" | "}
          Saturación: 100%
          {" | "}
          Brillo: 96%
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },

  logoContainer: {
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  logo: {
    width: 320,
    height: 140,
    resizeMode: "contain",
  },

  info: {
    marginTop: 20,
    alignItems: "center",
  },

  hex: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  hsv: {
    fontSize: 18,
  },

  button: {
    marginTop: 30,
    backgroundColor: "#222",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },

  result: {
    marginTop: 25,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },

  target: {
    marginTop: 15,
    textAlign: "center",
    fontSize: 16,
    color: "green",
  },
});
