import { useFocusEffect, useRouter } from "expo-router";
import type { ReactElement, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { DailyRoundResult, DailySubmitResult } from "@/api/types";
import ChallengeNavigation from "@/components/ChallengeNavigation";
import { ColorWheel, type ColorWheelHandle } from "@/components/ColorWheel";
import { ResultSheet } from "@/components/ResultSheet";
import SVGChallenge from "@/components/SVGChallenge";
import { Button } from "@/design/Button";
import {
  ErrorBanner,
  Loading,
  Pill,
  scoreTone,
  Stat,
  StatPill,
} from "@/design/Feedback";
import { Card, Divider, Screen, useIsTablet } from "@/design/Layout";
import { Color, Radius, Space, Type } from "@/design/tokens";
// Del hook offline solo se toma el color de arranque de la rueda; ver el
// comentario de `useDailyChallenge`, que explica por qué el resto no sirve.
import { INITIAL_HSV } from "@/hooks/useChallenge";
import {
  useDailyChallenge,
  type DailyRoundView,
} from "@/hooks/useDailyChallenge";
import { t } from "@/i18n";
import type { HSVColor } from "@/types/challenge";
import { getHSVDelta, getScoreMessage } from "@/utils/colorScore";
import { impact } from "@/utils/haptics";

/**
 * El reto diario, jugándose.
 *
 * El bucle es el mismo que el de `app/game.tsx` —logo, rueda, comprobar— pero
 * con dos diferencias que vienen de las reglas del plan y que explican por qué
 * esta pantalla no puede ser aquella:
 *
 *  1. **No hay resultado por ronda.** El color objetivo no llega hasta cerrar
 *     el intento (regla 6.2), así que responder una ronda solo avanza a la
 *     siguiente. El desglose de las cinco aparece de golpe al final, con lo que
 *     devuelve el servidor.
 *  2. **Aquí no se puntúa nada.** La cifra la calcula el backend (regla 6.1);
 *     la app se limita a mandar los colores elegidos.
 */
/**
 * Pausa entre comprobar y pasar a la ronda siguiente.
 *
 * El pulso del logo es la única confirmación de que el color se aplicó, y sin
 * esta pausa se vería sobre el logo **siguiente**: el mismo motivo por el que
 * `app/game.tsx` retrasa su hoja de resultado.
 */
const ADVANCE_DELAY_MS = 260;

export default function DailyPlayScreen(): ReactElement {
  const router = useRouter();
  const daily = useDailyChallenge();

  const wheelRef = useRef<ColorWheelHandle>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [animationToken, setAnimationToken] = useState(0);
  /** Entre el pulso y el cambio de ronda no se admite otro toque. */
  const [checking, setChecking] = useState(false);

  useEffect(
    () => () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }
    },
    [],
  );

  const {
    loading,
    error,
    status,
    rounds,
    roundIndex,
    currentRound,
    selectedColor,
    selectedHSV,
    setSelectedHSV,
    answerCurrent,
    submit,
    submitting,
    submitError,
    result,
    serverClosed,
    attemptsLeft,
    reload,
  } = daily;

  // La carga la lanza la pantalla, no el hook: mismo patrón que el resto del
  // árbol online.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const back = useCallback(() => {
    // `replace` y no `back`: al terminar el intento no tiene sentido que el
    // gesto de volver devuelva a un tablero que ya se ha enviado.
    router.replace("/online/daily");
  }, [router]);

  const handleColorChange = useCallback(
    (hsv: HSVColor): void => {
      setSelectedHSV(hsv);
    },
    [setSelectedHSV],
  );

  const handleCheck = useCallback((): void => {
    if (checking) {
      return;
    }
    setChecking(true);
    // El pulso del logo es la única confirmación de que el color se aplicó:
    // sin hoja de resultado por ronda, es lo que marca que la ronda se cerró.
    setAnimationToken((value) => value + 1);
    impact("light");

    // La respuesta queda fijada aquí, con el color que había al pulsar: mover
    // la rueda durante la pausa ya no cambia nada.
    advanceTimer.current = setTimeout(() => {
      setChecking(false);
      if (!answerCurrent()) {
        void submit();
        return;
      }
      // La rueda es no controlada: se reposiciona por referencia (ver
      // `components/ColorWheel.tsx`).
      wheelRef.current?.setColor(INITIAL_HSV);
    }, ADVANCE_DELAY_MS);
  }, [answerCurrent, checking, submit]);

  // -- Carga y errores duros -------------------------------------------------

  if (loading && !status) {
    return (
      <Screen
        eyebrow={t("online.daily.badge")}
        title={t("online.daily.title")}
        backTo="/online/daily"
        scrollable={false}
        contentStyle={styles.centered}
      >
        {error ? (
          <ErrorBanner
            message={error}
            onRetry={() => void daily.reload()}
            retryLabel={t("common.retry")}
          />
        ) : (
          <Loading label={t("online.daily.loading")} />
        )}
      </Screen>
    );
  }

  // -- Intento cerrado: el desglose -----------------------------------------

  if (result) {
    return (
      <AttemptResult
        result={result}
        canRetry={result.attemptsLeft > 0 && !serverClosed}
        onRetry={daily.restart}
        onFinish={back}
      />
    );
  }

  if (submitting) {
    return (
      <Screen
        eyebrow={t("online.daily.badge")}
        title={t("online.daily.title")}
        scrollable={false}
        contentStyle={styles.centered}
      >
        <Loading label={t("online.daily.submitting")} />
      </Screen>
    );
  }

  // El envío falló. Las respuestas siguen en el hook, así que se puede
  // reintentar sin volver a jugar las cinco rondas.
  if (submitError) {
    return (
      <Screen
        eyebrow={t("online.daily.badge")}
        title={t("online.daily.title")}
        backTo="/online/daily"
        scrollable={false}
        contentStyle={styles.centered}
      >
        <Card>
          <Text style={[Type.bodyStrong, styles.centeredText]}>
            {t("online.daily.submitFailed")}
          </Text>
          <ErrorBanner message={submitError} />
          {serverClosed ? null : (
            <Button
              label={t("online.daily.submitRetry")}
              icon="retry"
              onPress={() => void submit()}
              style={styles.cardAction}
            />
          )}
          <Button
            label={t("common.exit")}
            variant="ghost"
            onPress={back}
            style={styles.cardActionTight}
          />
        </Card>
      </Screen>
    );
  }

  // -- No se puede jugar ahora ----------------------------------------------

  if (serverClosed || attemptsLeft === 0 || !currentRound) {
    return (
      <Screen
        eyebrow={t("online.daily.badge")}
        title={t("online.daily.title")}
        backTo="/online/daily"
        scrollable={false}
        contentStyle={styles.centered}
      >
        <Card>
          <Text style={[Type.bodyStrong, styles.centeredText]}>
            {t(
              serverClosed
                ? "online.daily.closedTitle"
                : "online.daily.noAttemptsTitle",
            )}
          </Text>
          <Text style={[Type.caption, styles.centeredText, styles.cardBody]}>
            {t(
              serverClosed
                ? "online.daily.closedHint"
                : "online.daily.noAttemptsHint",
            )}
          </Text>
          <Button
            label={t("common.back")}
            icon="back"
            onPress={back}
            style={styles.cardAction}
          />
        </Card>
      </Screen>
    );
  }

  // -- El tablero ------------------------------------------------------------

  return (
    <PlayBoard
      round={currentRound}
      roundIndex={roundIndex}
      totalRounds={rounds.length}
      attemptNumber={(status?.attemptsUsed ?? 0) + 1}
      selectedColor={selectedColor}
      selectedHSV={selectedHSV}
      animationToken={animationToken}
      checking={checking}
      wheelRef={wheelRef}
      onColorChange={handleColorChange}
      onCheck={handleCheck}
    />
  );
}

// ---------------------------------------------------------------------------
// Tablero
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface PlayBoardProps {
  round: DailyRoundView;
  roundIndex: number;
  totalRounds: number;
  attemptNumber: number;
  selectedColor: string;
  selectedHSV: HSVColor;
  animationToken: number;
  /** Pausa entre el pulso y el cambio de ronda: el botón no admite otro toque. */
  checking: boolean;
  wheelRef: RefObject<ColorWheelHandle | null>;
  onColorChange: (hsv: HSVColor) => void;
  onCheck: () => void;
}

/**
 * La misma composición que el juego offline —logo arriba, rueda debajo, y en
 * tableta uno al lado del otro—, con las medidas calculadas igual: son las que
 * ya están probadas en pantallas cortas.
 */
function PlayBoard({
  round,
  roundIndex,
  totalRounds,
  attemptNumber,
  selectedColor,
  selectedHSV,
  animationToken,
  checking,
  wheelRef,
  onColorChange,
  onCheck,
}: PlayBoardProps): ReactElement {
  const { width, height } = useWindowDimensions();
  const isTablet = useIsTablet();
  const isCompactHeight = height < 760;
  const isLast = roundIndex === totalRounds - 1;

  const challengeSize = useMemo(() => {
    const shortest = Math.min(width, height);
    const base = isTablet
      ? shortest * 0.32
      : isCompactHeight
        ? shortest * 0.38
        : shortest * 0.44;
    return clamp(base, isTablet ? 200 : 148, isTablet ? 300 : 230);
  }, [height, isCompactHeight, isTablet, width]);

  const wheelSize = useMemo(() => {
    const column = isTablet ? width / 2 : width;
    const available = column - Space.xl * 2 - 30 - Space.lg;
    return clamp(available, 180, isCompactHeight ? 240 : 280);
  }, [isCompactHeight, isTablet, width]);

  return (
    <Screen
      backTo="/online/daily"
      headerAction={
        <StatPill
          label={t("online.daily.attemptLabel")}
          value={t("online.daily.attemptValue", { number: attemptNumber })}
        />
      }
      contentStyle={styles.playShell}
    >
      <ChallengeNavigation currentIndex={roundIndex} total={totalRounds} />

      <View
        style={[
          styles.board,
          isCompactHeight && styles.boardCompact,
          isTablet && styles.boardTablet,
        ]}
      >
        <View style={styles.challengeColumn}>
          {round.asset ? (
            <SVGChallenge
              challenge={round.asset}
              editableColor={selectedColor}
              // El color a adivinar lo decide el SERVIDOR: se pasa su
              // `colorIndex` y no el `editableColorIndex` del catálogo local,
              // que no siempre coincide.
              editableColorIndex={round.colorIndex}
              size={challengeSize}
              animationToken={animationToken}
            />
          ) : (
            <MissingAsset assetId={round.assetId} size={challengeSize} />
          )}
        </View>

        <View style={styles.pickerColumn}>
          <ColorWheel
            ref={wheelRef}
            initialColor={selectedHSV}
            onChange={onColorChange}
            onChangeComplete={onColorChange}
            size={wheelSize}
          />
        </View>
      </View>

      <Button
        label={t(isLast ? "online.daily.finish" : "online.daily.check")}
        onPress={onCheck}
        disabled={checking}
        style={styles.checkButton}
      />
    </Screen>
  );
}

/**
 * El servidor ha mandado un logo que esta versión de la app no tiene.
 *
 * Pasa si se regenera el catálogo de un lado y no el del otro. Se deja jugar
 * igualmente —a ciegas, pero sin gastar el intento en un callejón sin salida—
 * porque el servidor exige respuesta para todas las rondas.
 */
function MissingAsset({
  assetId,
  size,
}: {
  assetId: string;
  size: number;
}): ReactElement {
  return (
    <View style={[styles.missing, { width: size, height: size }]}>
      <Text style={[Type.bodyStrong, styles.centeredText]}>
        {t("online.daily.missingAsset")}
      </Text>
      <Text style={[Type.caption, styles.centeredText]}>{assetId}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Resultado del intento
// ---------------------------------------------------------------------------

/**
 * El desglose que devuelve el servidor: puntos del intento, puesto del día y
 * ronda a ronda. Cada fila abre la `ResultSheet` de siempre con su detalle,
 * que es donde vive la comparación de los dos colores.
 */
function AttemptResult({
  result,
  canRetry,
  onRetry,
  onFinish,
}: {
  result: DailySubmitResult;
  canRetry: boolean;
  onRetry: () => void;
  onFinish: () => void;
}): ReactElement {
  const [detail, setDetail] = useState<DailyRoundResult | null>(null);

  const improved = result.attempt.score >= result.best;

  return (
    <>
      <Screen
        eyebrow={t("online.daily.badge")}
        title={t("online.daily.resultTitle")}
        subtitle={t("online.daily.attemptValue", {
          number: result.attempt.attemptNumber,
        })}
      >
        <Card style={styles.block}>
          <View style={styles.resultStats}>
            <Stat
              value={String(result.attempt.score)}
              label={t("online.daily.attemptPoints")}
            />
            <Stat
              value={String(result.best)}
              label={t("online.daily.bestLabel")}
              hint={improved ? t("online.daily.bestIsThis") : undefined}
            />
            <Stat
              value={`#${result.position}`}
              label={t("online.daily.position")}
              hint={t("online.daily.positionHint")}
            />
          </View>

          <Divider style={styles.resultDivider} />

          <View style={styles.resultFooter}>
            <Text style={Type.caption}>
              {result.xpEarned > 0
                ? t("online.daily.xpEarned", { xp: result.xpEarned })
                : t("online.daily.xpAlready")}
            </Text>
            <Pill
              label={
                result.attemptsLeft > 0
                  ? t("online.daily.attemptsOneLeft")
                  : t("online.daily.statusUsed")
              }
              tone={result.attemptsLeft > 0 ? "accent" : "neutral"}
            />
          </View>
        </Card>

        {/* --------------------- Ronda a ronda ------------------------- */}
        <Card style={styles.block}>
          {result.attempt.rounds.map((detailRound, index) => (
            <RoundRow
              key={detailRound.round}
              detail={detailRound}
              last={index === result.attempt.rounds.length - 1}
              onPress={() => setDetail(detailRound)}
            />
          ))}
        </Card>

        <View style={styles.resultActions}>
          {canRetry ? (
            <Button
              label={t("online.daily.playSecond")}
              icon="retry"
              onPress={onRetry}
            />
          ) : null}
          <Button
            label={t("online.daily.finishAttempt")}
            icon="home"
            variant={canRetry ? "secondary" : "primary"}
            onPress={onFinish}
          />
        </View>
      </Screen>

      {/*
        La hoja de resultado de siempre, con el detalle de una ronda. Es el
        único sitio donde aparece el color objetivo, y solo después de haber
        cerrado el intento.
      */}
      <ResultSheet
        visible={detail != null}
        score={detail?.accuracy ?? 0}
        message={t(getScoreMessage(detail?.accuracy ?? 0))}
        targetColor={detail?.target.hex ?? "#FFFFFF"}
        yourColor={detail?.answer.hex ?? "#FFFFFF"}
        delta={
          detail
            ? getHSVDelta(detail.answer.hsv, detail.target.hsv)
            : { h: 0, s: 0, v: 0 }
        }
        onNext={() => setDetail(null)}
        nextLabel={t("common.continue")}
      />
    </>
  );
}

/** Una ronda del desglose: los dos colores, la precisión y los puntos. */
function RoundRow({
  detail,
  last,
  onPress,
}: {
  detail: DailyRoundResult;
  last: boolean;
  onPress: () => void;
}): ReactElement {
  return (
    // La fila entera abre el detalle: un porcentaje de 40 puntos de ancho no es
    // un objetivo táctil, y aquí no hay ninguna otra acción que confundir.
    <Pressable
      style={({ pressed }) => [
        styles.roundRow,
        last && styles.roundRowLast,
        pressed && styles.roundRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("online.daily.roundDetail", {
        round: detail.round,
      })}
    >
      <Text style={[Type.label, styles.roundNumber]}>{detail.round}</Text>

      <View style={styles.swatches}>
        <View
          style={[styles.swatch, { backgroundColor: detail.answer.hex }]}
          accessibilityRole="image"
          accessibilityLabel={t("result.yours")}
        />
        <View
          style={[styles.swatch, { backgroundColor: detail.target.hex }]}
          accessibilityRole="image"
          accessibilityLabel={t("result.target")}
        />
      </View>

      <View style={styles.roundText}>
        <Text style={Type.bodyStrong} numberOfLines={1}>
          {detail.assetId}
        </Text>
        <Text style={Type.caption}>
          {t("online.daily.roundPoints", { points: detail.score })}
        </Text>
      </View>

      <Text style={[Type.metricSmall, { color: scoreTone(detail.accuracy) }]}>
        {detail.accuracy}%
      </Text>
    </Pressable>
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
  cardActionTight: {
    marginTop: Space.sm,
  },
  block: {
    marginBottom: Space.xxl,
  },
  playShell: {
    justifyContent: "space-between",
    paddingBottom: Space.xl,
  },
  board: {
    // `flexGrow` y no `flex: 1`, por lo mismo que en `app/game.tsx`: en una
    // pantalla corta el atajo encogía el tablero por debajo de lo que ocupan
    // el logo y la rueda.
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingTop: Space.xxl,
    gap: Space.xxl,
  },
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
  missing: {
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
    padding: Space.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Color.border.default,
    backgroundColor: Color.surface.raised,
  },
  resultStats: {
    flexDirection: "row",
  },
  resultDivider: {
    marginVertical: Space.xl,
  },
  resultFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
  },
  resultActions: {
    gap: Space.sm,
    marginBottom: Space.xxl,
  },
  roundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.border.subtle,
  },
  roundRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  roundRowPressed: {
    opacity: 0.6,
  },
  roundNumber: {
    width: 16,
  },
  swatches: {
    flexDirection: "row",
    gap: Space.xxs,
  },
  swatch: {
    width: 22,
    height: 32,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  roundText: {
    flex: 1,
    gap: Space.xxs,
  },
});
