import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import ChallengeNavigation from "@/components/ChallengeNavigation";
import { ColorWheel, type ColorWheelHandle } from "@/components/ColorWheel";
import { ResultSheet } from "@/components/ResultSheet";
import SVGChallenge from "@/components/SVGChallenge";
import { Button } from "@/design/Button";
import { Loading, Stat, StatPill, StarRating } from "@/design/Feedback";
import { Card, Divider, Screen, useIsTablet } from "@/design/Layout";
import { Color, Space, Type } from "@/design/tokens";
import { INITIAL_HSV, useChallenge } from "@/hooks/useChallenge";
import { t, type TranslationKey } from "@/i18n";
import type { GameMode, HSVColor } from "@/types/challenge";
import {
  calculateColorScore,
  countHits,
  getHSVDelta,
  getRunMessage,
  getScoreMessage,
  isHit,
  summarizeRun,
  timedRunPoints,
  type HSVDelta,
} from "@/utils/colorScore";
import { feedbackForScore } from "@/utils/haptics";
import { playGameOver, playScoreSound } from "@/utils/sound";
import {
  clearProgress,
  getDailyResult,
  loadProgress,
  saveProgress,
  setDailyResult,
  submitBestStreak,
  submitHighScore,
  type DailyResult,
  type SavedProgress,
} from "@/utils/storage";

const VALID_MODES: GameMode[] = ["quick", "timed", "daily", "multicolor"];
const TIMED_SECONDS = 30;

/**
 * Retardo entre el intento y la aparición del resultado.
 *
 * Deja ver el pulso del logo al aplicarse el color antes de tapar la pantalla.
 * Sin esta pausa el modal se come la única confirmación visual de que el color
 * se aplicó de verdad.
 */
const RESULT_DELAY_MS = 260;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeMode(value: string | string[] | undefined): GameMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return VALID_MODES.includes(raw as GameMode) ? (raw as GameMode) : "quick";
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dailySeed(): number {
  return Number.parseInt(todayKey().replace(/-/g, ""), 10);
}

/** Texto de estrellas para compartir. En pantalla se usa `StarRating`. */
function starString(stars: number): string {
  return "★★★".slice(0, stars) + "☆☆☆".slice(0, 3 - stars);
}

export default function GameScreen(): ReactElement {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = normalizeMode(params.mode);
  const seed = mode === "daily" ? dailySeed() : undefined;

  const [ready, setReady] = useState(false);
  const [resume, setResume] = useState<SavedProgress | null>(null);
  const [dailyDone, setDailyDone] = useState<DailyResult | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      if (mode === "daily") {
        const daily = await getDailyResult();
        if (active && daily?.dateKey === todayKey()) {
          setDailyDone(daily);
          setReady(true);
          return;
        }
      }

      const saved = await loadProgress();
      if (active) {
        // Ver `handleCheck`: el contrarreloj no persiste, así que tampoco
        // rehidrata. Una partida guardada de otro modo no le sirve.
        setResume(
          saved && saved.mode === mode && mode !== "timed" ? saved : null,
        );
        setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [mode]);

  if (!ready) {
    return (
      <Screen scrollable={false} contentStyle={styles.centered}>
        <Loading label={t("common.loading")} />
      </Screen>
    );
  }

  if (dailyDone) {
    return <DailyDoneScreen result={dailyDone} />;
  }

  return <GamePlay mode={mode} seed={seed} resume={resume} />;
}

function DailyDoneScreen({ result }: { result: DailyResult }): ReactElement {
  const router = useRouter();

  return (
    <Screen backTo="/offline" scrollable={false} contentStyle={styles.centered}>
      <Card>
        <Text style={[Type.title, styles.centeredText]}>
          {t("daily.done.title")}
        </Text>
        <Text style={[Type.body, styles.centeredText, styles.cardBody]}>
          {t("daily.done.subtitle")}
        </Text>
        <Text style={[Type.metric, styles.centeredText, styles.cardBody]}>
          {t("daily.score", { score: result.score })}
        </Text>
        {/* `dismissTo` y no `replace`, por lo mismo que la flecha de `Screen`:
            retrocede por la pila en vez de duplicar el destino en ella. */}
        <Button
          label={t("summary.home")}
          icon="home"
          onPress={() => router.dismissTo("/offline")}
          style={styles.cardAction}
        />
      </Card>
    </Screen>
  );
}

interface GamePlayProps {
  mode: GameMode;
  seed?: number;
  resume: SavedProgress | null;
}

function GamePlay({ mode, seed, resume }: GamePlayProps): ReactElement {
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const isTablet = useIsTablet();

  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    challengeIds,
    selectedColor,
    selectedHSV,
    setSelectedHSV,
    nextStep,
  } = useChallenge({ mode, seed, resume });

  const wheelRef = useRef<ColorWheelHandle>(null);

  const [scores, setScores] = useState<number[]>(resume?.scores ?? []);
  const [resultVisible, setResultVisible] = useState(false);
  const [score, setScore] = useState(0);
  const [resultMessage, setResultMessage] = useState("");
  const [targetColorHex, setTargetColorHex] = useState("#FFFFFF");
  const [yourColorHex, setYourColorHex] = useState("#FFFFFF");
  const [delta, setDelta] = useState<HSVDelta>({ h: 0, s: 0, v: 0 });
  const [animationToken, setAnimationToken] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);
  const [isRecord, setIsRecord] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  /**
   * El récord se lee del almacenamiento y llega después de que la pantalla de
   * resumen ya esté pintada. Sin esta bandera, el primer fotograma del resumen
   * decía «Mejor: 0» —el valor inicial— y se corregía al siguiente: una cifra
   * falsa parpadeando justo donde el jugador va a mirar.
   */
  const [recordReady, setRecordReady] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreakValue, setBestStreakValue] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMED_SECONDS);

  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Cierra el paso a un segundo intento sobre la misma imagen.
   *
   * `scoresRef` se muta a mano y la hoja de resultado tarda `RESULT_DELAY_MS` en
   * aparecer, así que dos toques seguidos a «comprobar» añadían **dos**
   * puntuaciones al mismo reto: la partida terminaba con más intentos que
   * imágenes y la media salía contaminada. Es una referencia y no estado porque
   * dos toques en el mismo fotograma leerían los dos el mismo estado viejo; una
   * referencia se ve escrita al instante.
   */
  const checkingRef = useRef(false);
  const scoresRef = useRef(scores);
  const maxStreakRef = useRef(0);
  const finishedRef = useRef(false);

  const isTimed = mode === "timed";
  const isDaily = mode === "daily";
  const targetColor = currentStep?.target;

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

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

  /**
   * Diámetro de la rueda.
   *
   * Se calcula a partir del ancho que queda realmente libre —descontando el
   * margen de pantalla, el deslizador de brillo y el hueco entre ambos— en lugar
   * de una fracción del alto. La versión anterior calculaba una altura de
   * tarjeta y se la pasaba al picker en una prop que el componente ni siquiera
   * declaraba, así que el cálculo no hacía nada.
   */
  const wheelSize = useMemo(() => {
    const column = isTablet ? width / 2 : width;
    const available = column - Space.xl * 2 - 30 - Space.lg;
    return clamp(available, 180, isCompactHeight ? 240 : 280);
  }, [isCompactHeight, isTablet, width]);

  const summary = useMemo(() => summarizeRun(scores), [scores]);

  /**
   * Marcador del contrarreloj.
   *
   * `scores` guarda siempre la precisión cruda —la necesitan el resultado de
   * cada intento, la media y la racha—, y los puntos se derivan de ella. Sin un
   * número fijo de imágenes, sumar la precisión tal cual premiaría disparar al
   * azar: cada intento sumaría algo. Con la penalización, fallar resta.
   */
  const timedPoints = useMemo(
    () => (isTimed ? timedRunPoints(scores) : summary.total),
    [isTimed, scores, summary.total],
  );
  const hits = useMemo(() => countHits(scores), [scores]);

  useEffect(() => {
    return () => {
      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
      }
    };
  }, []);

  const finalizeGame = useCallback(async (): Promise<void> => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    setGameFinished(true);

    const runSummary = summarizeRun(scoresRef.current);
    // `gameOver.mp3` estaba en el registro de sonidos desde el principio, pero
    // no había ni una llamada que lo reprodujese: el cierre de partida era el
    // único momento importante del juego sin respuesta sonora.
    playGameOver();

    // El récord del contrarreloj son los puntos con penalización, no la suma de
    // precisiones: es la cifra que el jugador ve durante la partida.
    const runTotal =
      mode === "timed"
        ? timedRunPoints(scoresRef.current)
        : runSummary.total;

    const record = await submitHighScore(mode, runTotal);
    setIsRecord(record.isRecord);
    setBestScore(record.best);
    setRecordReady(true);

    if (mode === "timed") {
      const streakRecord = await submitBestStreak("timed", maxStreakRef.current);
      setBestStreakValue(streakRecord.best);
    }

    if (mode === "daily") {
      await setDailyResult({ dateKey: todayKey(), score: runSummary.average });
    }

    await clearProgress();
  }, [mode]);

  /** Emitido por la rueda: HSV puro, sin pasar por hexadecimal. */
  const handleColorChange = useCallback(
    (hsv: HSVColor): void => {
      setSelectedHSV(hsv);
    },
    [setSelectedHSV],
  );

  const handleCheck = useCallback((): void => {
    if (!targetColor || checkingRef.current) {
      return;
    }
    checkingRef.current = true;

    const nextScore = calculateColorScore(selectedHSV, targetColor.hsv);
    const nextScores = [...scoresRef.current, nextScore];
    scoresRef.current = nextScores;
    setScores(nextScores);

    setScore(nextScore);
    setResultMessage(t(getScoreMessage(nextScore)));
    setTargetColorHex(targetColor.hex);
    setYourColorHex(selectedColor);
    setDelta(getHSVDelta(selectedHSV, targetColor.hsv));
    setAnimationToken((value) => value + 1);
    feedbackForScore(nextScore);
    playScoreSound(nextScore);

    if (isTimed) {
      setStreak((prev) => {
        const updated = isHit(nextScore) ? prev + 1 : 0;
        maxStreakRef.current = Math.max(maxStreakRef.current, updated);
        return updated;
      });
    }

    // El contrarreloj no se guarda. Reanudar restaura los puntos pero no el
    // reloj, así que con un límite de ocho imágenes ya era una fuga —salir y
    // volver regalaba el reloj entero— y sin límite no tendría fondo. Una
    // carrera de 30 segundos se juega entera o no se juega.
    if (!isTimed) {
      void saveProgress({
        mode,
        challengeIds,
        stepIndex: Math.min(currentStepIndex + 1, Math.max(totalSteps - 1, 0)),
        scores: nextScores,
        savedAt: Date.now(),
      });
    }

    setResultVisible(false);

    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
    }
    resultTimerRef.current = setTimeout(() => {
      setResultVisible(true);
    }, RESULT_DELAY_MS);
  }, [
    targetColor,
    selectedHSV,
    selectedColor,
    isTimed,
    mode,
    challengeIds,
    currentStepIndex,
    totalSteps,
  ]);

  const handleNext = useCallback((): void => {
    setResultVisible(false);
    // Se abre la siguiente imagen: vuelve a admitirse un intento.
    checkingRef.current = false;

    const hasNext = nextStep();
    if (!hasNext) {
      void finalizeGame();
      return;
    }

    // La rueda es no controlada: se reposiciona por referencia. Es el único
    // camino de entrada, y por eso ningún color de salida puede realimentarla.
    wheelRef.current?.setColor(INITIAL_HSV);
  }, [nextStep, finalizeGame]);

  const handleGoHome = useCallback((): void => {
    setResultVisible(false);
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    void clearProgress();
    // Ver la flecha de `Screen`: se retrocede por la pila, no se sustituye la
    // entrada actual, para que el «atrás» del sistema siga estando de acuerdo.
    router.dismissTo("/offline");
  }, [router]);

  const handleRetry = useCallback((): void => {
    void clearProgress();
    router.replace(`/game?mode=${mode}`);
  }, [mode, router]);

  const handleShare = useCallback(async (): Promise<void> => {
    try {
      await Share.share({
        // El contrarreloj no tiene máximo que enseñar —«420/800» dejó de
        // significar nada al quitarle el límite—, así que comparte puntos y
        // aciertos, que es lo que sí se puede comparar entre dos partidas.
        message: isTimed
          ? t("summary.shareTimed", {
              mode: t(`mode.${mode}.title` as TranslationKey),
              score: timedPoints,
              hits,
              rounds: summary.rounds,
              average: summary.average,
              stars: starString(summary.stars),
            })
          : t("summary.shareText", {
              mode: t(`mode.${mode}.title` as TranslationKey),
              total: summary.total,
              max: summary.max,
              average: summary.average,
              stars: starString(summary.stars),
            }),
      });
    } catch {
      // Compartir se canceló o no está disponible; no hay nada que hacer.
    }
  }, [hits, isTimed, mode, summary, timedPoints]);

  // Cuenta atrás del modo contrarreloj. Se pausa con el resultado abierto para
  // que leer el feedback nunca cueste tiempo.
  useEffect(() => {
    if (!isTimed || gameFinished || resultVisible) {
      return;
    }
    if (timeLeft <= 0) {
      void finalizeGame();
      return;
    }
    const id = setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [isTimed, gameFinished, resultVisible, timeLeft, finalizeGame]);

  if (gameFinished) {
    return (
      <Screen scrollable contentStyle={styles.centered}>
        <Card>
          <View style={styles.summaryHead}>
            <Text style={[Type.title, styles.centeredText]}>
              {t("summary.title")}
            </Text>
            <Text style={[Type.body, styles.centeredText, styles.cardBody]}>
              {t(getRunMessage(summary.average))}
            </Text>
            <View style={styles.summaryStars}>
              <StarRating value={summary.stars} size={22} />
            </View>
          </View>

          <Divider style={styles.summaryDivider} />

          {/*
            El contrarreloj cuenta otra historia: sin límite de imágenes, «total
            sobre máximo» no existe. Lo que importa son los puntos ganados, los
            aciertos de verdad —los que pasan del 60 %— y con cuántos intentos.
          */}
          <View style={styles.summaryStats}>
            {isTimed ? (
              <>
                {/* La cifra va sola y el «pts» lo dice el rótulo: son tres
                    columnas repartiéndose el ancho de la tarjeta, y en un móvil
                    estrecho «120 pts» a 20 px no cabe en un tercio. */}
                <Stat
                  value={`${timedPoints}`}
                  label={t("summary.points")}
                />
                <Stat
                  value={`${hits}`}
                  label={t("summary.hits")}
                  hint={t("summary.hitsOf", { rounds: summary.rounds })}
                />
                <Stat
                  value={`${summary.average}%`}
                  label={t("summary.average")}
                />
              </>
            ) : (
              <>
                <Stat
                  value={`${summary.total}/${summary.max}`}
                  label={t("summary.total")}
                />
                <Stat
                  value={`${summary.average}%`}
                  label={t("summary.average")}
                />
              </>
            )}
          </View>

          {recordReady ? (
            <>
              <Text style={[Type.caption, styles.centeredText, styles.record]}>
                {isRecord
                  ? t("summary.record")
                  : t("summary.best", { score: bestScore })}
              </Text>
              {isTimed ? (
                <Text style={[Type.caption, styles.centeredText]}>
                  {t("summary.bestStreak", { count: bestStreakValue })}
                </Text>
              ) : null}
            </>
          ) : null}

          <View style={styles.summaryActions}>
            <Button
              label={t("summary.home")}
              icon="home"
              onPress={handleGoHome}
            />
            {!isDaily ? (
              <Button
                label={t("common.retry")}
                icon="retry"
                variant="secondary"
                onPress={handleRetry}
              />
            ) : null}
            <Button
              label={t("common.share")}
              icon="share"
              variant="ghost"
              onPress={handleShare}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  if (currentStep == null) {
    return (
      <Screen backTo="/offline" scrollable={false} contentStyle={styles.centered}>
        <Card>
          <Text style={[Type.heading, styles.centeredText]}>
            {t("game.empty.title")}
          </Text>
          <Text style={[Type.body, styles.centeredText, styles.cardBody]}>
            {t("game.empty.subtitle")}
          </Text>
        </Card>
      </Screen>
    );
  }

  const showColorStep = currentStep.colorCount > 1;

  return (
    <>
      <Screen
        backTo="/offline"
        headerAction={
          isTimed || showColorStep ? (
            <View style={styles.statusRow}>
              {isTimed ? (
                <>
                  <StatPill
                    label={t("timer.label")}
                    value={t("timer.seconds", { seconds: timeLeft })}
                    tone={timeLeft <= 10 ? "danger" : "neutral"}
                  />
                  <StatPill
                    label={t("streak.label")}
                    value={t("streak.value", { count: streak })}
                    tone={streak > 0 ? "success" : "neutral"}
                  />
                </>
              ) : null}
              {showColorStep ? (
                <StatPill
                  label={t("game.colorStep", {
                    current: currentStep.colorPosition,
                    total: currentStep.colorCount,
                  })}
                  value={`${currentStep.colorPosition}/${currentStep.colorCount}`}
                />
              ) : null}
            </View>
          ) : undefined
        }
        contentStyle={styles.playShell}
      >
        {/*
          Sin límite de imágenes, la barra de progreso mentía: marcaba «reto 3
          de 137» y un relleno que no se movía, dando a entender que hay una
          lista que terminar. En su hueco va lo que sí avanza en este modo, los
          aciertos y los puntos. El resto de modos conservan su barra.
        */}
        {isTimed ? (
          <View style={styles.timedRun}>
            <Text style={Type.label}>{t("game.runLabel")}</Text>
            <Text style={Type.metricSmall}>
              {t("game.hits", { count: hits })} ·{" "}
              {t("game.points", { score: timedPoints })}
            </Text>
          </View>
        ) : (
          <ChallengeNavigation
            currentIndex={currentStepIndex}
            total={totalSteps}
          />
        )}

        <View
          style={[
            styles.board,
            isCompactHeight && styles.boardCompact,
            isTablet && styles.boardTablet,
          ]}
        >
          <View style={styles.challengeColumn}>
            <SVGChallenge
              challenge={currentStep.challenge}
              editableColor={selectedColor}
              editableColorIndex={currentStep.colorIndex}
              size={challengeSize}
              animationToken={animationToken}
            />
          </View>

          <View style={styles.pickerColumn}>
            <ColorWheel
              ref={wheelRef}
              initialColor={selectedHSV}
              onChange={handleColorChange}
              onChangeComplete={handleColorChange}
              size={wheelSize}
            />
          </View>
        </View>

        {/* `resultVisible` deshabilita además el botón mientras la hoja de
            resultado está abierta: la guarda de `handleCheck` ya impide el
            doble envío, pero un botón que sigue pareciendo pulsable debajo del
            modal invita a intentarlo. */}
        <Button
          label={t("game.check")}
          // Neutro por la regla del pigmento: la pantalla esta ensenando el
          // color que hay que acertar. Ver `design/Button.tsx`.
          tone="neutral"
          onPress={handleCheck}
          disabled={targetColor == null || resultVisible}
          style={styles.checkButton}
        />
      </Screen>

      <ResultSheet
        visible={resultVisible}
        score={score}
        message={resultMessage}
        targetColor={targetColorHex}
        yourColor={yourColorHex}
        delta={delta}
        onNext={handleNext}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: "center",
  },
  centeredText: {
    textAlign: "center",
  },
  cardBody: {
    marginTop: Space.sm,
  },
  cardAction: {
    marginTop: Space.xl,
  },
  playShell: {
    justifyContent: "space-between",
    paddingBottom: Space.xl,
  },
  statusRow: {
    flexDirection: "row",
    gap: Space.sm,
  },
  timedRun: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  board: {
    // `flexGrow` y no `flex: 1`. El atajo `flex: 1` incluye `flexBasis: 0` y
    // `flexShrink: 1`, así que en una pantalla corta el tablero se encogía por
    // debajo de lo que ocupan el logo y la rueda y los recortaba, sin dejar
    // además nada que desplazar. Creciendo solo hacia arriba, reparte el hueco
    // cuando sobra y conserva su altura real cuando falta: entonces es la
    // pantalla la que se desplaza.
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-evenly",
    // `space-evenly` reparte el hueco que sobra, pero cuando no sobra deja el
    // logo pegado a la barra de progreso y a la rueda. Estos dos valores son el
    // suelo: por debajo de aquí no bajan nunca.
    paddingTop: Space.xxl,
    gap: Space.xxl,
  },
  /**
   * En una pantalla baja el respiro se cobra a la mitad. Mantener los 32 puntos
   * ahí obligaría a desplazar la pantalla para llegar al botón de comprobar, y
   * tener que hacer scroll en cada intento cuesta más que unos milímetros de
   * aire.
   */
  boardCompact: {
    paddingTop: Space.lg,
    gap: Space.lg,
  },
  boardTablet: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  challengeColumn: {
    alignItems: "center",
    justifyContent: "center",
  },
  pickerColumn: {
    alignItems: "center",
    justifyContent: "center",
  },
  checkButton: {
    marginTop: Space.lg,
  },
  summaryHead: {
    alignItems: "center",
  },
  summaryStars: {
    marginTop: Space.lg,
  },
  summaryDivider: {
    marginVertical: Space.xl,
  },
  summaryStats: {
    flexDirection: "row",
    marginBottom: Space.lg,
  },
  /**
   * El récord es lo único en color de la tarjeta de resumen: es la cifra que
   * decide si esta partida ha valido para algo, y en gris se pierde entre las
   * estadísticas que tiene justo encima.
   */
  record: {
    color: Color.accent.text,
  },
  summaryActions: {
    marginTop: Space.xxl,
    gap: Space.sm,
  },
});
