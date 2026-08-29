import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { createDevApi, type DevTimeState } from "@/api/dev";
import { describeError } from "@/api/errors";
import { Button } from "@/design/Button";
import { ErrorBanner } from "@/design/Feedback";
import { Card, SectionHeader } from "@/design/Layout";
import { Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import { useSession } from "@/online/session";

/**
 * Panel de viaje en el tiempo (apartado 5.5 del plan).
 *
 * Sin esto, probar el ciclo de una temporada desde la app sería esperar 10 días
 * reales o irse a `curl`. Con esto son dos toques.
 *
 * **Nunca aparece fuera de `__DEV__`.** La comprobación es lo primero que hace
 * el componente, así que en una build de producción el árbol entero se queda en
 * nada; y aunque alguien lo forzara, las rutas `/api/dev` tampoco existen allí:
 * el backend no monta el router salvo con `DEV_TIME_TRAVEL=true`.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export function DevTimePanel({
  groupId,
  onChanged,
}: {
  /** Si se pasa, se puede terminar la temporada de ESE grupo sin mover el reloj. */
  groupId?: string;
  /** Para releer la pantalla: el estado del grupo se deriva de la hora. */
  onChanged: () => void | Promise<void>;
}): ReactElement | null {
  if (!__DEV__) {
    return null;
  }

  // Todo el estado vive en `Panel`, no aquí: así este componente no tiene
  // hooks que se salten la guarda de `__DEV__`, y en producción se queda en un
  // `return null` sin más.
  return <Panel {...(groupId ? { groupId } : {})} onChanged={onChanged} />;
}

function Panel({
  groupId,
  onChanged,
}: {
  groupId?: string;
  onChanged: () => void | Promise<void>;
}): ReactElement {
  const { client } = useSession();
  const dev = useMemo(() => createDevApi(client), [client]);

  const [state, setState] = useState<DevTimeState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, action: () => Promise<DevTimeState | unknown>) => {
      setBusy(key);
      setError(null);
      try {
        const result = await action();
        // `endSeason` no devuelve el reloj: en ese caso se relee aparte.
        if (result && typeof result === "object" && "offsetMs" in result) {
          setState(result as DevTimeState);
        } else {
          setState(await dev.time());
        }
        await onChanged();
      } catch (devError) {
        setError(describeError(devError));
      } finally {
        setBusy(null);
      }
    },
    [dev, onChanged],
  );

  const offset = state?.offsetMs ?? 0;
  const offsetLabel =
    offset === 0
      ? t("online.dev.realTime")
      : t("online.dev.offset", {
          days: Math.trunc(offset / DAY_MS),
          hours: Math.trunc((offset % DAY_MS) / HOUR_MS),
        });

  return (
    <>
      <SectionHeader title={t("online.dev.title")} hint={t("online.dev.hint")} />
      <Card style={styles.card}>
        {error ? <ErrorBanner message={error} /> : null}

        <Text style={[Type.caption, styles.state]}>
          {offsetLabel}
          {state ? ` · ${new Date(state.now).toLocaleString()}` : ""}
        </Text>

        <View style={styles.row}>
          <Button
            label={t("online.dev.day")}
            variant="secondary"
            size="md"
            fullWidth={false}
            loading={busy === "day"}
            onPress={() => void run("day", () => dev.advance({ days: 1 }))}
            style={styles.button}
          />
          <Button
            label={t("online.dev.tenDays")}
            variant="secondary"
            size="md"
            fullWidth={false}
            loading={busy === "tenDays"}
            onPress={() => void run("tenDays", () => dev.advance({ days: 10 }))}
            style={styles.button}
          />
        </View>

        {groupId ? (
          <Button
            label={t("online.dev.endSeason")}
            variant="secondary"
            size="md"
            icon="hourglass"
            loading={busy === "endSeason"}
            onPress={() => void run("endSeason", () => dev.endSeason(groupId))}
            style={styles.stacked}
          />
        ) : null}

        <Button
          label={t("online.dev.reset")}
          variant="ghost"
          size="md"
          icon="retry"
          loading={busy === "reset"}
          onPress={() => void run("reset", () => dev.reset())}
          style={styles.stacked}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Space.xxl,
  },
  state: {
    marginBottom: Space.md,
  },
  row: {
    flexDirection: "row",
    gap: Space.sm,
  },
  button: {
    flex: 1,
  },
  stacked: {
    marginTop: Space.sm,
  },
});
