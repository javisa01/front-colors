import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/design/Button";
import { Chip, Field, Stepper } from "@/design/Form";
import { Card, Screen, SectionHeader } from "@/design/Layout";
import { Color, Radius, Space, Type } from "@/design/tokens";
import { t, type TranslationKey } from "@/i18n";
import type { PartyMode, PartyPlayer } from "@/types/challenge";
import {
  BATTLE_IMAGES,
  buildPartyConfig,
  clampPlayers,
  coopImagesPerPlayer,
  isCooperativeMode,
  isTimedMode,
  MAX_PLAYERS,
  MIN_PLAYERS,
  setPartyConfig,
  turnSecondsFor,
} from "@/utils/party";

const VALID_MODES: PartyMode[] = [
  "battle",
  "battle-timed",
  "coop",
  "coop-timed",
];

/** Atajos a los tamaños de grupo habituales; el resto se llega con el contador. */
const QUICK_COUNTS = [2, 3, 4, 6, 8];

function normalizeMode(value: string | string[] | undefined): PartyMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return VALID_MODES.includes(raw as PartyMode) ? (raw as PartyMode) : "battle";
}

/**
 * Configuración de una partida en grupo: cuántos sois y cómo os llamáis.
 *
 * Los nombres se piden en campos sin rótulo, con el número del jugador dentro
 * del propio campo: con ocho jugadores, un rótulo encima de cada uno duplicaba
 * el alto de la lista para repetir la misma palabra ocho veces. El marcador de
 * posición dice a la vez qué se espera y qué nombre se usará si se deja vacío.
 */
export default function PartySetupScreen(): ReactElement {
  const params = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const mode = normalizeMode(params.mode);

  const timed = isTimedMode(mode);
  const cooperative = isCooperativeMode(mode);

  const [count, setCount] = useState(MIN_PLAYERS);
  const [names, setNames] = useState<string[]>([]);

  const setPlayerCount = useCallback((next: number) => {
    setCount(clampPlayers(next));
  }, []);

  const setName = useCallback((index: number, value: string) => {
    setNames((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  }, []);

  const infoText = useMemo(() => {
    if (timed) {
      return t("party.setup.timedInfo", {
        seconds: turnSecondsFor(mode, count),
      });
    }
    if (cooperative) {
      return t("party.setup.coopInfo", {
        count: coopImagesPerPlayer(count),
      });
    }
    return t("party.setup.battleInfo", { count: BATTLE_IMAGES });
  }, [cooperative, count, mode, timed]);

  const handleStart = useCallback(() => {
    const players: PartyPlayer[] = Array.from({ length: count }, (_, index) => {
      const custom = names[index]?.trim();
      return {
        id: index,
        name:
          custom && custom.length > 0
            ? custom
            : t("party.playerN", { n: index + 1 }),
      };
    });

    setPartyConfig(buildPartyConfig(mode, players));
    router.push({ pathname: "/party", params: { mode } });
  }, [count, mode, names, router]);

  return (
    <Screen
      backTo="/offline"
      eyebrow={t(`party.mode.${mode}.title` as TranslationKey)}
      title={t("party.setup.title")}
      subtitle={infoText}
    >
      <SectionHeader
        title={t("party.setup.playersLabel")}
        hint={t("party.setup.playersHint", {
          min: MIN_PLAYERS,
          max: MAX_PLAYERS,
        })}
      />

      <Card style={styles.block}>
        <Stepper
          value={count}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          onChange={setPlayerCount}
          decreaseLabel={t("a11y.playersDecrease")}
          increaseLabel={t("a11y.playersIncrease")}
        />

        <View style={styles.quickRow}>
          {QUICK_COUNTS.map((value) => (
            <Chip
              key={value}
              label={String(value)}
              selected={count === value}
              onPress={() => setPlayerCount(value)}
            />
          ))}
        </View>
      </Card>

      <SectionHeader
        title={t("party.setup.namesLabel")}
        hint={t("party.setup.namesHint")}
      />

      <Card style={styles.block}>
        {Array.from({ length: count }, (_, index) => (
          <Field
            key={index}
            value={names[index] ?? ""}
            onChangeText={(value) => setName(index, value)}
            placeholder={t("party.playerN", { n: index + 1 })}
            leading={
              <View style={styles.nameBadge}>
                <Text style={[Type.metricSmall, styles.nameBadgeText]}>
                  {index + 1}
                </Text>
              </View>
            }
            autoCapitalize="words"
            maxLength={20}
            returnKeyType="done"
            style={
              index === count - 1 ? styles.lastNameField : styles.nameField
            }
          />
        ))}
      </Card>

      <Button
        label={t("party.setup.start")}
        icon="play"
        onPress={handleStart}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Space.sm,
    marginTop: Space.xl,
  },
  nameField: {
    marginBottom: Space.sm,
  },
  lastNameField: {
    marginBottom: 0,
  },
  nameBadge: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface.raised,
    borderWidth: 1,
    borderColor: Color.border.subtle,
  },
  nameBadgeText: {
    color: Color.text.muted,
  },
});
