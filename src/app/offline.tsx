import { useFocusEffect, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SettingsButton } from "@/components/SettingsButton";
import { AmbientOrbs } from "@/design/Ambient";
import { Pill } from "@/design/Feedback";
import type { IconName } from "@/design/Icon";
import { OptionRow, Screen, SectionHeader } from "@/design/Layout";
import { Space, type SpectrumTone } from "@/design/tokens";
import { t, type TranslationKey } from "@/i18n";
import type { GameMode, PartyMode } from "@/types/challenge";
import { getHighScore, getTeamAverageRecord } from "@/utils/storage";

/**
 * Menú de juego sin conexión: modos en solitario y modos en grupo.
 *
 * Antes cada tarjeta llevaba un emoji sobre un degradado de color distinto —ocho
 * cuadros de colores compitiendo en una misma lista, sin que ninguno significase
 * nada. Ahora todos los iconos comparten superficie neutra y el color queda para
 * lo único que sí es información: el récord conseguido.
 */

interface ModeCard<T extends string> {
  id: T;
  icon: IconName;
  tone: SpectrumTone;
}

/**
 * Los tonos se reparten para que dentro de una misma sección no se repita
 * ninguno: el color está aquí para que reconozcas el modo antes de leer su
 * título, y dos filas del mismo color en la misma lista no distinguen nada.
 * Entre las dos secciones sí se repiten —hay seis tonos y ocho modos—, y no
 * importa porque un encabezado las separa.
 */
const SOLO_MODES: ModeCard<GameMode>[] = [
  { id: "quick", icon: "zap", tone: "amber" },
  { id: "timed", icon: "timer", tone: "blue" },
  { id: "daily", icon: "calendar", tone: "violet" },
  { id: "multicolor", icon: "palette", tone: "teal" },
];

const PARTY_MODES: ModeCard<PartyMode>[] = [
  { id: "battle", icon: "swords", tone: "rose" },
  { id: "battle-timed", icon: "flame", tone: "amber" },
  { id: "coop", icon: "users", tone: "green" },
  { id: "coop-timed", icon: "hourglass", tone: "teal" },
];

/**
 * Modos en grupo que llevan récord.
 *
 * Solo los colaborativos: en los competitivos el resultado es una clasificación
 * entre quienes están delante del móvil esa tarde, y «el mejor de la partida»
 * no es una marca que se pueda batir otro día. Un equipo sí compite contra su
 * propia media anterior.
 */
const COOP_RECORD_MODES: PartyMode[] = ["coop", "coop-timed"];

/** Escalonado de entrada. 45 ms es perceptible como orden sin sentirse lento. */
const STAGGER_MS = 45;

export default function OfflineScreen(): ReactElement {
  const router = useRouter();

  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [bestAverages, setBestAverages] = useState<Record<string, number>>({});

  /**
   * Al **enfocar**, no al montar.
   *
   * Esta pantalla vive en la pila mientras se juega: se llega a un modo con
   * `push` y se vuelve con `dismissTo`, que retrocede hasta ella sin
   * desmontarla. Con un `useEffect` de montaje los récords se leían una sola
   * vez, cuando aún no había ninguno, y al terminar una partida se volvía aquí
   * y el galón seguía sin aparecer —o seguía enseñando la marca vieja— hasta
   * cerrar y abrir la aplicación. `useFocusEffect` vuelve a leerlos cada vez
   * que la pantalla pasa al frente, que es justo cuando pueden haber cambiado.
   */
  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const [solo, coop] = await Promise.all([
          Promise.all(
            SOLO_MODES.map(
              async (mode) => [mode.id, await getHighScore(mode.id)] as const,
            ),
          ),
          Promise.all(
            COOP_RECORD_MODES.map(
              async (mode) => [mode, await getTeamAverageRecord(mode)] as const,
            ),
          ),
        ]);

        if (active) {
          setBestScores(Object.fromEntries(solo));
          setBestAverages(Object.fromEntries(coop));
        }
      })();

      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <Screen
      backTo="/"
      eyebrow={t("offline.badge")}
      title={t("offline.title")}
      subtitle={t("offline.subtitle")}
      backdrop={<AmbientOrbs />}
      headerAction={<SettingsButton />}
    >
      <SectionHeader
        title={t("offline.solo.section")}
        hint={t("offline.solo.hint")}
      />

      <View style={styles.group}>
        {SOLO_MODES.map((mode, index) => {
          const best = bestScores[mode.id] ?? 0;

          return (
            <OptionRow
              key={mode.id}
              icon={mode.icon}
              tone={mode.tone}
              title={t(`mode.${mode.id}.title` as TranslationKey)}
              description={t(`mode.${mode.id}.description` as TranslationKey)}
              badge={
                best > 0 ? (
                  <Pill label={t("home.best", { score: best })} tone="accent" />
                ) : undefined
              }
              onPress={() =>
                router.push({
                  pathname: "/game",
                  params: { mode: mode.id },
                })
              }
              enterDelay={index * STAGGER_MS}
            />
          );
        })}
      </View>

      <SectionHeader
        title={t("offline.group.section")}
        hint={t("offline.group.hint")}
      />

      <View style={styles.group}>
        {PARTY_MODES.map((mode, index) => {
          // El récord de un colaborativo es un porcentaje, no unos puntos: la
          // pastilla lo dice con su propio texto para que no se lea como una
          // puntuación comparable con la de los modos en solitario.
          const bestAverage = bestAverages[mode.id] ?? 0;

          return (
            <OptionRow
              key={mode.id}
              icon={mode.icon}
              tone={mode.tone}
              title={t(`party.mode.${mode.id}.title` as TranslationKey)}
              description={t(
                `party.mode.${mode.id}.description` as TranslationKey,
              )}
              badge={
                bestAverage > 0 ? (
                  <Pill
                    label={t("home.bestAverage", { average: bestAverage })}
                    tone="accent"
                  />
                ) : undefined
              }
              onPress={() =>
                router.push({
                  pathname: "/party-setup",
                  params: { mode: mode.id },
                })
              }
              enterDelay={(SOLO_MODES.length + index) * STAGGER_MS}
            />
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Space.md,
    marginBottom: Space.xxl,
  },
});
