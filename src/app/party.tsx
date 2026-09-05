import { useRouter, type Href } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { ColorWheel, type ColorWheelHandle } from "@/components/ColorWheel";
import SVGChallenge from "@/components/SVGChallenge";
import { AmbientTable, ResultConstellation } from "@/design/Ambient";
import { playerTint } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { Pill, StatPill, scoreTone } from "@/design/Feedback";
import { Icon } from "@/design/Icon";
import { Card, Divider, Screen, SectionHeader, useIsTablet, usePlayBottomSpace } from "@/design/Layout";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  Duration,
  PARTY_TONE,
  Radius,
  Space,
  Type,
  type Palette,
} from "@/design/tokens";
import { INITIAL_HSV } from "@/hooks/useChallenge";
import { useParty } from "@/hooks/useParty";
import { t, type TranslationKey } from "@/i18n";
import type { HSVColor, PartyConfig } from "@/types/challenge";
import { hsvToHex } from "@/utils/color";
import {
  calculateColorScore,
  countHits,
  getRunMessage,
  scoreTimedGuess,
} from "@/utils/colorScore";
import { feedbackForScore } from "@/utils/haptics";
import { buildPartyConfig, getPartyConfig } from "@/utils/party";
import { playGameOver, playScoreSound } from "@/utils/sound";
import {
  submitTeamAverageRecord,
  type HighScoreResult,
} from "@/utils/storage";

/**
 * Partida en grupo sobre un mismo móvil.
 *
 * Las cinco fases comparten el armazón `Screen` de la aplicación en lugar del
 * degradado y los botones azules que esta pantalla se pintaba a sí misma: el
 * turno de juego se ve exactamente igual que el modo en solitario, que es lo
 * mínimo que se espera cuando son el mismo juego.
 */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function PartyScreen(): ReactElement | null {
  const router = useRouter();
  const [config, setConfig] = useState<PartyConfig | null>(() =>
    getPartyConfig(),
  );
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!config) {
      // Se llega aquí al recargar o entrar por enlace directo, sin config en
      // memoria. `dismissTo` retrocede hasta `/offline` si está en la pila y la
      // sustituye si no, así que sirve para los dos casos.
      router.dismissTo("/offline");
    }
  }, [config, router]);

  if (!config) {
    return null;
  }

  return (
    <PartyGame
      key={runId}
      config={config}
      onExit={() => router.dismissTo("/offline")}
      onReplay={() => {
        setConfig(buildPartyConfig(config.mode, config.players));
        setRunId((value) => value + 1);
      }}
    />
  );
}

interface PartyGameProps {
  config: PartyConfig;
  onExit: () => void;
  onReplay: () => void;
}

function PartyGame({ config, onExit, onReplay }: PartyGameProps): ReactElement {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const playBottom = usePlayBottomSpace();
  const { width, height } = useWindowDimensions();
  const isTablet = useIsTablet();

  const {
    phase,
    playerIndex,
    slot,
    timeLeft,
    lastAccuracy,
    currentStep,
    guesses,
    turnHits,
    turnStreak,
    beginTurn,
    submitGuess,
    proceed,
  } = useParty(config);

  // Igual que en `game.tsx`: el HSV es la fuente de verdad y el hexadecimal se
  // deriva de él. Ver `components/ColorWheel.tsx` para el porqué.
  const [selectedHSV, setSelectedHSV] = useState<HSVColor>(INITIAL_HSV);
  const selectedColor = useMemo(
    () => hsvToHex(selectedHSV.h, selectedHSV.s, selectedHSV.v),
    [selectedHSV],
  );
  const wheelRef = useRef<ColorWheelHandle>(null);

  /**
   * Cierra el paso a un segundo intento sobre la misma imagen.
   *
   * Sin esto, dos toques seguidos a «comprobar» registraban **dos** intentos
   * del jugador de turno: en contrarreloj le regalaban puntos y aciertos, y en
   * los modos por turnos le gastaban de golpe la imagen siguiente. Es una
   * referencia y no estado porque dos toques en el mismo fotograma leerían los
   * dos el mismo estado viejo. Ver la misma guarda en `app/game.tsx`.
   */
  const checkingRef = useRef(false);

  useEffect(() => {
    if (phase === "final") {
      playGameOver();
    }
  }, [phase]);

  /**
   * Reserva de la flecha de volver, no su destino habitual.
   *
   * La flecha retrocede por el historial, así que desde una partida lleva a
   * `/party-setup`, un solo salto, igual que el botón «atrás» del sistema. Este
   * `/offline` solo entra en juego si se llega a `/party` sin historial, y ahí
   * tampoco hay configuración en memoria: la guarda de arriba manda al menú de
   * todas formas.
   */
  const backHref: Href = "/offline";

  const currentPlayer = config.players[playerIndex];
  const stepKey = `${playerIndex}-${slot}-${guesses.length}`;
  const [lastStepKey, setLastStepKey] = useState(stepKey);

  // Reinicia la selección cuando toca adivinar un color nuevo. Ajustar el
  // estado durante el render (en lugar de en un efecto) evita un repintado
  // extra con el color anterior.
  if (stepKey !== lastStepKey) {
    setLastStepKey(stepKey);
    setSelectedHSV(INITIAL_HSV);
  }

  // La rueda es no controlada, así que reposicionarla es un efecto secundario y
  // no puede hacerse durante el render como el estado de arriba.
  //
  // `stepKey` incluye el número de intentos, así que cambia en cuanto uno se
  // registra: es exactamente el momento en que vuelve a admitirse otro, tanto
  // en los modos por turnos —donde además cambia el jugador— como en
  // contrarreloj, donde el mismo jugador encadena imágenes sin soltar el móvil.
  useEffect(() => {
    checkingRef.current = false;
    wheelRef.current?.setColor(INITIAL_HSV);
  }, [stepKey]);

  const isCompactHeight = height < 760;

  const challengeSize = useMemo(() => {
    const shortest = Math.min(width, height);
    const base = isTablet
      ? shortest * 0.32
      : isCompactHeight
        ? shortest * 0.38
        : shortest * 0.44;
    return clamp(base, isTablet ? 200 : 148, isTablet ? 300 : 230);
  }, [height, isCompactHeight, isTablet, width]);

  // Mismo criterio que en `game.tsx`: la rueda se dimensiona por el ancho libre
  // real, descontando márgenes, deslizador de brillo y el hueco entre ambos.
  const wheelSize = useMemo(() => {
    const column = isTablet ? width / 2 : width;
    const available = column - Space.xl * 2 - 30 - Space.lg;
    return clamp(available, 180, isCompactHeight ? 240 : 280);
  }, [isCompactHeight, isTablet, width]);

  /**
   * Ambos van memoizados a propósito. `ColorWheel` construye sus gestos con un
   * `useMemo` que depende de estos manejadores: con una función nueva en cada
   * render, los dos gestos de la rueda se reconstruían en cada pasada de React
   * —y durante un arrastre hay muchas—. `game.tsx` ya lo hacía así.
   */
  const handleColorChange = useCallback((hsv: HSVColor): void => {
    setSelectedHSV(hsv);
  }, []);

  const handleCheck = useCallback((): void => {
    if (!currentStep || checkingRef.current) {
      return;
    }
    checkingRef.current = true;

    const accuracy = calculateColorScore(selectedHSV, currentStep.target.hsv);
    feedbackForScore(accuracy);
    playScoreSound(accuracy);

    // La precisión viaja junto a los puntos, no en su lugar. En contrarreloj los
    // puntos salen penalizados y ya no se puede saber por ellos si el intento
    // fue bueno: un 55 % y un 65 % valen −8 y +5, pero solo uno es acierto.
    submitGuess({
      accuracy,
      score: config.timed ? scoreTimedGuess(accuracy) : accuracy,
      targetHex: currentStep.target.hex,
      guessHex: selectedColor,
    });
  }, [config.timed, currentStep, selectedColor, selectedHSV, submitGuess]);

  // ---- Derived results -------------------------------------------------

  const perPlayer = useMemo(
    () =>
      config.players.map((player, index) => {
        const own = guesses.filter((guess) => guess.player === index);
        return {
          player,
          index,
          score: own.reduce((sum, guess) => sum + guess.score, 0),
          // Aciertos, no intentos: el rótulo del marcador final dice «aciertos»
          // y hasta ahora enseñaba el número de veces que el jugador había
          // pulsado comprobar, acertase o no.
          hits: countHits(own.map((guess) => guess.accuracy)),
          rounds: own.length,
        };
      }),
    [config.players, guesses],
  );

  const ranking = useMemo(
    () => [...perPlayer].sort((a, b) => b.score - a.score),
    [perPlayer],
  );

  const roundGuesses = useMemo(
    () =>
      guesses
        .filter((guess) => guess.slot === slot)
        .map((guess) => ({
          ...guess,
          name: config.players[guess.player]?.name ?? "",
        }))
        .sort((a, b) => b.score - a.score),
    [config.players, guesses, slot],
  );

  const teamTotal = useMemo(
    () => guesses.reduce((sum, guess) => sum + guess.score, 0),
    [guesses],
  );
  const teamMax =
    config.cooperative && !config.timed
      ? config.players.length * config.imagesPerPlayer * 100
      : guesses.length * 100;

  /**
   * La media del equipo es de **precisión**, no de puntos.
   *
   * Se calculaba sobre `score`, y en colaborativo contrarreloj esos puntos van
   * penalizados: un equipo mediocre daba «Media del equipo: −12 %», y ese mismo
   * número alimentaba a `getRunMessage`, que espera una escala de 0 a 100.
   */
  const teamAverage = useMemo(() => {
    if (guesses.length === 0) {
      return 0;
    }
    const total = guesses.reduce((sum, guess) => sum + guess.accuracy, 0);
    return Math.round(total / guesses.length);
  }, [guesses]);

  /**
   * Récord del equipo, solo en los modos colaborativos.
   *
   * Se guarda la media de precisión y no los puntos: ver
   * `submitTeamAverageRecord`. Se envía una sola vez, al entrar en la fase
   * final —`teamAverage` ya no cambia ahí, porque no quedan intentos que
   * añadir—, y hasta que la lectura vuelve no se pinta ninguna línea: enseñar
   * «Mejor media: 0 %» durante un fotograma para corregirlo después es peor que
   * no enseñar nada.
   */
  const [teamRecord, setTeamRecord] = useState<HighScoreResult | null>(null);

  useEffect(() => {
    if (phase !== "final" || !config.cooperative) {
      return;
    }

    let active = true;
    void (async () => {
      const result = await submitTeamAverageRecord(config.mode, teamAverage);
      if (active) {
        setTeamRecord(result);
      }
    })();

    return () => {
      active = false;
    };
  }, [config.cooperative, config.mode, phase, teamAverage]);

  const modeTitle = t(`party.mode.${config.mode}.title` as TranslationKey);
  /** El color del modo, el mismo desde la fila del menú. Ver `PARTY_TONE`. */
  const modeTone = PARTY_TONE[config.mode];

  // ---- Fases ------------------------------------------------------------

  if (phase === "handoff") {
    /*
      El color de quien tiene el turno. Sale de su nombre con la misma fórmula
      que usan su chapa en la configuración y su fila en la clasificación de un
      grupo online, así que una persona lleva un solo color en toda la
      aplicación. Ver `design/Avatar`.
    */
    const tint = playerTint(currentPlayer.name);

    return (
      <Screen
        backTo={backHref}
        eyebrow={modeTitle}
        title={t("party.handoff.title", { name: currentPlayer.name })}
        subtitle={t("party.handoff.subtitle")}
        backdrop={<AmbientTable tone={modeTone} />}
      >
        <Card>
          {/*
            La chapa del jugador, a tamaño grande.

            Antes era un icono de dos muñecos en un cuadro gris, y decía justo lo
            contrario de lo que la pantalla necesita decir: esto no va de «un
            grupo», va de **una** persona, la que tiene que coger el móvil ahora.
            El número es el mismo con el que escribió su nombre hace un minuto, y
            el color es el suyo, así que se reconoce sin llegar a leer el título.
          */}
          <View
            style={[
              styles.handoffMark,
              { backgroundColor: tint.fill, borderColor: tint.border },
            ]}
          >
            <Text style={[Type.metricHero, { color: tint.text }]}>
              {playerIndex + 1}
            </Text>
          </View>

          <View style={styles.handoffMeta}>
            {config.mode === "battle" ? (
              <Pill
                label={t("party.handoff.image", {
                  current: slot + 1,
                  total: config.sharedSteps.length,
                })}
              />
            ) : null}
            {config.timed ? (
              <Pill
                icon="timer"
                tone="warning"
                label={t("party.handoff.timed", {
                  seconds: config.turnSeconds,
                })}
              />
            ) : null}
          </View>

          <Button
            label={t("party.handoff.start")}
            icon="play"
            tone={modeTone}
            onPress={beginTurn}
            style={styles.cardAction}
          />
        </Card>
      </Screen>
    );
  }

  if (phase === "playing") {
    return (
      <Screen
        backTo={backHref}
        headerAction={
          <View style={styles.statusRow}>
            {config.timed ? (
              // Mismo par que el contrarreloj en solitario: tiempo y racha. Los
              // aciertos bajan a la fila del jugador; tres galones en la barra
              // superior no caben en un móvil estrecho.
              <>
                <StatPill
                  label={t("timer.label")}
                  value={t("timer.seconds", { seconds: timeLeft })}
                  tone={timeLeft <= 10 ? "danger" : "neutral"}
                />
                <StatPill
                  label={t("streak.label")}
                  value={t("streak.value", { count: turnStreak })}
                  tone={turnStreak > 0 ? "success" : "neutral"}
                />
              </>
            ) : (
              <Pill
                label={t("party.play.image", {
                  current: slot + 1,
                  total:
                    config.mode === "battle"
                      ? config.sharedSteps.length
                      : config.imagesPerPlayer,
                })}
              />
            )}
          </View>
        }
        contentStyle={[styles.playShell, { paddingBottom: playBottom }]}
      >
        <View style={styles.turnRow}>
          <Pill icon="user" label={currentPlayer.name} tone="accent" />
          {config.timed ? (
            <Pill
              label={t("party.play.solved", { count: turnHits })}
              tone={turnHits > 0 ? "success" : "neutral"}
            />
          ) : null}
        </View>

        {currentStep ? (
          <>
            <View
              style={[
                styles.board,
                isCompactHeight && styles.boardCompact,
                isTablet && styles.boardTablet,
              ]}
            >
              <View style={styles.column}>
                <SVGChallenge
                  challenge={currentStep.challenge}
                  editableColor={selectedColor}
                  editableColorIndex={currentStep.colorIndex}
                  size={challengeSize}
                  animationToken={guesses.length}
                />
              </View>

              <View style={styles.column}>
                <ColorWheel
                  ref={wheelRef}
                  initialColor={selectedHSV}
                  onChange={handleColorChange}
                  onChangeComplete={handleColorChange}
                  size={wheelSize}
                />
              </View>
            </View>

            <Button
              label={t("party.play.check")}
              onPress={handleCheck}
              style={styles.checkButton}
            />
          </>
        ) : null}
      </Screen>
    );
  }

  if (phase === "guessResult") {
    return (
      <Screen
        backTo={backHref}
        eyebrow={currentPlayer.name}
        title={t("party.guess.title")}
        subtitle={t("party.guess.hidden")}
        backdrop={<ResultConstellation />}
      >
        <Card>
          <Animated.View
            entering={FadeIn.duration(Duration.base)}
            style={styles.scoreBlock}
          >
            <Text style={Type.label}>{t("result.kicker")}</Text>
            {/* La cifra lleva un «%» detrás, así que es la precisión lo que
                tiene que salir aquí, nunca los puntos ya penalizados. */}
            <Text style={[Type.metricHero, { color: scoreTone(colors, lastAccuracy) }]}>
              {lastAccuracy}%
            </Text>
          </Animated.View>

          <Button
            label={t("common.continue")}
            onPress={proceed}
            style={styles.cardAction}
          />
        </Card>
      </Screen>
    );
  }

  if (phase === "roundResult") {
    return (
      <Screen
        backTo={backHref}
        eyebrow={t("party.play.image", {
          current: slot + 1,
          total: config.sharedSteps.length,
        })}
        title={t("party.round.title")}
        backdrop={<ResultConstellation />}
      >
        <Card style={styles.block}>
          {currentStep ? (
            <>
              <View style={styles.correctBlock}>
                <View
                  style={[
                    styles.correctSwatch,
                    { backgroundColor: currentStep.target.hex },
                  ]}
                  accessibilityRole="image"
                  accessibilityLabel={`${t("party.round.correct")}: ${
                    currentStep.target.hex
                  }`}
                />
                <View>
                  <Text style={Type.label}>{t("party.round.correct")}</Text>
                  <Text style={[Type.metricSmall, styles.correctHex]}>
                    {currentStep.target.hex}
                  </Text>
                </View>
              </View>

              <Divider style={styles.divider} />
            </>
          ) : null}

          {roundGuesses.map((guess, index) => (
            <RankRow
              key={`${guess.player}-${index}`}
              position={index + 1}
              name={guess.name}
              swatch={guess.guessHex}
              value={`${guess.accuracy}%`}
              valueTone={scoreTone(colors, guess.accuracy)}
              highlight={index === 0}
              last={index === roundGuesses.length - 1}
            />
          ))}
        </Card>

        <Button label={t("common.next")} onPress={proceed} />
      </Screen>
    );
  }

  // ---- Final ------------------------------------------------------------

  const isTie = ranking.length > 1 && ranking[0].score === ranking[1].score;

  return (
    <Screen
      eyebrow={modeTitle}
      backdrop={<ResultConstellation />}
      title={
        config.cooperative
          ? t("party.final.coopTitle")
          : t("party.final.title")
      }
      subtitle={
        config.cooperative
          ? t(getRunMessage(teamAverage))
          : isTie
            ? t("party.final.tie")
            : t("party.final.winner", { name: ranking[0]?.player.name })
      }
    >
      {config.cooperative ? (
        <>
          <Card style={styles.block}>
            <View style={styles.scoreBlock}>
              <Text style={Type.metricHero}>
                {config.timed
                  ? t("party.final.points", { score: teamTotal })
                  : t("party.final.teamScore", {
                      score: teamTotal,
                      max: teamMax,
                    })}
              </Text>
              <Text style={Type.body}>
                {t("party.final.teamAverage", { average: teamAverage })}
              </Text>
              {teamRecord != null ? (
                <Text style={[Type.caption, styles.teamRecord]}>
                  {teamRecord.isRecord
                    ? t("party.final.teamRecordNew")
                    : t("party.final.teamRecord", {
                        average: teamRecord.best,
                      })}
                </Text>
              ) : null}
            </View>
          </Card>

          {/* La lista de abajo deja de ser una clasificación cuando se juega en
              equipo: es el reparto de quién ha puesto cuánto. */}
          <SectionHeader title={t("party.final.contributions")} />
        </>
      ) : null}

      <Card style={styles.block}>
        {ranking.map((entry, index) => (
          <RankRow
            key={entry.index}
            position={index + 1}
            name={entry.player.name}
            value={
              config.timed || config.cooperative
                ? `${entry.score} · ${t("party.final.rounds", {
                    count: entry.hits,
                  })}`
                : t("party.final.points", { score: entry.score })
            }
            highlight={index === 0 && !config.cooperative && !isTie}
            last={index === ranking.length - 1}
          />
        ))}
      </Card>

      <View style={styles.finalActions}>
        <Button
          label={t("party.final.replay")}
          icon="retry"
          onPress={onReplay}
        />
        <Button
          label={t("party.final.home")}
          icon="home"
          variant="ghost"
          onPress={onExit}
        />
      </View>
    </Screen>
  );
}

/**
 * Fila de clasificación.
 *
 * La usan el resultado de una ronda y el marcador final, así que el puesto, el
 * nombre y la cifra caen siempre en la misma rejilla. Antes eran dos bloques
 * distintos con los mismos estilos copiados.
 */
function RankRow({
  position,
  name,
  swatch,
  value,
  valueTone,
  highlight,
  last,
}: {
  position: number;
  name: string;
  /** Color que propuso el jugador, cuando la fila es de una ronda. */
  swatch?: string;
  value: string;
  valueTone?: string;
  highlight: boolean;
  last: boolean;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  return (
    <View style={[styles.rankRow, last && styles.rankRowLast]}>
      <View
        style={styles.rankPosition}
        accessible
        accessibilityLabel={t("a11y.rank", { position })}
      >
        {highlight ? (
          <Icon name="trophy" size={16} color={colors.warning.default} />
        ) : (
          <Text style={Type.metricSmall}>{position}</Text>
        )}
      </View>

      {swatch != null ? (
        <View style={[styles.rankSwatch, { backgroundColor: swatch }]} />
      ) : null}

      <Text style={[Type.bodyStrong, styles.rankName]} numberOfLines={1}>
        {name}
      </Text>

      <Text style={[Type.metricSmall, valueTone != null && { color: valueTone }]}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  block: {
    marginBottom: Space.lg,
  },
  handoffMark: {
    alignSelf: "center",
    // Más grande que la chapa de 26 de la configuración, y con el mismo radio
    // proporcional: es la misma cosa vista de cerca, no otra distinta.
    width: 76,
    height: 76,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    // Relleno y borde los pone `playerTint`: son de esa persona.
    borderWidth: 1,
  },
  handoffMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Space.sm,
    marginTop: Space.lg,
  },
  cardAction: {
    marginTop: Space.xl,
  },
  /**
   * `paddingBottom` se completa con la zona segura desde el componente: aquí
   * solo está el aire mínimo. Ver la nota de `playBottom`.
   */
  playShell: {
    justifyContent: "space-between",
    paddingBottom: Space.xl,
  },
  statusRow: {
    flexDirection: "row",
    gap: Space.sm,
  },
  turnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
    marginBottom: Space.sm,
  },
  board: {
    // Ver `game.tsx`: `flexGrow` en lugar de `flex: 1` para que el tablero
    // conserve su altura real cuando la pantalla se queda corta y sea la
    // pantalla la que se desplace.
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-evenly",
    // Mismo suelo de separación que en `game.tsx`: el turno de una partida en
    // grupo y el modo en solitario tienen que respirar igual.
    paddingTop: Space.xxl,
    gap: Space.xxl,
  },
  /** En pantalla baja, la mitad de aire: ver `game.tsx`. */
  boardCompact: {
    paddingTop: Space.lg,
    gap: Space.lg,
  },
  boardTablet: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  column: {
    alignItems: "center",
    justifyContent: "center",
  },
  checkButton: {
    marginTop: Space.lg,
  },
  scoreBlock: {
    alignItems: "center",
    gap: Space.xs,
  },
  teamRecord: {
    marginTop: Space.xs,
    // El récord es el único texto en color de la tarjeta: es lo que hay que ver
    // de un vistazo al terminar, por encima de la media de esta partida.
    color: c.accent.text,
  },
  correctBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.lg,
  },
  correctSwatch: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    // Un aro claro translúcido: un borde opaco desaparece sobre los colores
    // claros y la muestra parece flotar.
    borderColor: "rgba(255,255,255,0.16)",
  },
  correctHex: {
    marginTop: Space.xxs,
    color: c.text.primary,
  },
  divider: {
    marginVertical: Space.lg,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
  },
  rankRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  rankPosition: {
    width: 22,
    alignItems: "center",
  },
  rankSwatch: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  rankName: {
    flex: 1,
  },
  finalActions: {
    gap: Space.sm,
    marginTop: Space.lg,
  },
  });
