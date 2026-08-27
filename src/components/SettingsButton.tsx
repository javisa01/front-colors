import { useCallback, useState, type ReactElement } from "react";
import { StyleSheet } from "react-native";

import { SettingsSheet } from "@/components/SettingsSheet";
import { IconButton } from "@/design/Button";
import { Space } from "@/design/tokens";
import { t } from "@/i18n";

/**
 * Rueda de ajustes para la barra superior: se pasa como `headerAction`.
 *
 * Trae dentro su propia hoja y su propio estado abierto/cerrado. Estaba escrito
 * a mano en la portada y en el menú offline —botón, `useState`, hoja hermana y
 * el mismo margen negativo copiado—, y al llevarlo también a las cuatro
 * pantallas online serían seis copias de lo mismo divergiendo por su cuenta.
 *
 * La hoja se pinta aquí, dentro de la cabecera, y no como hermana de la
 * pantalla: `Sheet` monta un `Modal`, que sale del flujo de la disposición, y
 * mientras está cerrada devuelve `null`. Ninguno de los dos estados empuja nada
 * en la barra.
 */
export function SettingsButton(): ReactElement {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => {
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <>
      <IconButton
        name="settings"
        onPress={open}
        accessibilityLabel={t("settings.title")}
        // Sangrado negativo: el área táctil de 44pt es mayor que el dibujo, así
        // que sin esto el icono queda ópticamente metido hacia dentro respecto
        // al título que tiene debajo.
        style={styles.button}
      />

      <SettingsSheet visible={visible} onClose={close} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: -Space.md,
  },
});
