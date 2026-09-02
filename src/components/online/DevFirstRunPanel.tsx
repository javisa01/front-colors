import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTour } from "@/components/online/OnlineTour";
import { Button } from "@/design/Button";
import { Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import { setFirstRunMock, useFirstRunMock } from "@/online/devFirstRun";
import { setOnlineTourSeen } from "@/utils/storage";

/**
 * El interruptor de «primera vez en el online». **Solo en desarrollo.**
 *
 * Hace las dos cosas que hacen falta para ver el recorrido de la barra tal y
 * como lo verá quien acabe de registrarse, y las hace juntas porque por separado
 * no sirven de nada: **vacía los grupos** —ver `online/devFirstRun`— y **borra
 * la marca** de recorrido visto. Sin lo primero, la pantalla de hoy enseña el
 * muro de retos y el último paso no tiene a qué apuntar; sin lo segundo, el
 * recorrido no vuelve a salir nunca.
 *
 * Arranca a mano y no espera a que la pantalla se dé cuenta: el arranque
 * automático solo se pregunta una vez por sesión, así que la segunda pulsación
 * no habría hecho nada.
 *
 * La comprobación de `__DEV__` es lo primero que hace, igual que en
 * `DevTimePanel` y `DevTutorialCard`: en una build de producción el árbol entero
 * se queda en `null` y no hay ni un `useState` que se salte la guarda.
 */
export function DevFirstRunPanel(): ReactElement | null {
  if (!__DEV__) {
    return null;
  }

  return <Panel />;
}

function Panel(): ReactElement {
  const mocking = useFirstRunMock();
  const { start } = useTour();
  const [busy, setBusy] = useState(false);

  const simulate = useCallback(async () => {
    setBusy(true);
    setFirstRunMock(true);
    await setOnlineTourSeen(false);
    setBusy(false);
    start();
  }, [start]);

  const restore = useCallback(() => {
    setFirstRunMock(false);
  }, []);

  return (
    <View style={styles.panel}>
      <Text style={Type.label}>{t("dev.firstRunTitle")}</Text>
      <Text style={[Type.caption, styles.hint]}>{t("dev.firstRunHint")}</Text>

      <Button
        label={t(mocking ? "dev.firstRunOff" : "dev.firstRunButton")}
        icon="retry"
        variant="secondary"
        size="md"
        loading={busy}
        onPress={mocking ? restore : () => void simulate()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: Space.xxl,
    gap: Space.sm,
  },
  hint: {
    marginBottom: Space.xs,
  },
});
