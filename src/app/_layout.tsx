import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      {" "}
      <SafeAreaProvider>
        {" "}
        <View style={styles.shell}>
          {" "}
          <StatusBar style="light" translucent backgroundColor="#09090B" />{" "}
          <Slot />{" "}
        </View>{" "}
      </SafeAreaProvider>{" "}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  shell: {
    flex: 1,
    backgroundColor: "#09090B",
  },
});
