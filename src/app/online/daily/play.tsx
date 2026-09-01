import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
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
import { ResultConstellation } from "@/design/Ambient";
import { Button } from "@/design/Button";
import {
  ErrorBanner,
  Loading,
  Pill,
  scoreTone,
  Stat,
  StatPill,
} from "@/design/Feedback";
import { Notice } from "@/design/Form";
import { Card, Divider, Screen, useIsTablet } from "@/design/Layout";
import { Color, Radius, SECTION_TONE, Space, Type } from "@/design/tokens";
// Del hook offline solo se toma el color de arranque de la rueda; ver el
// comentario de `useDailyChallenge`, que explica por qué el resto no sirve.
import { INITIAL_HSV } from "@/hooks/useChallenge";
import {
  useDailyChallenge,
  type DailyRoundView,
} from "@/hooks/useDailyChallenge";
import { t } from "@/i18n";
import { addDailyXp, saveAttempt } from "@/online/attempts";
import type { HSVColor } from "@/types/challenge";
import {
  calculateColorScore,
  getHSVDelta,
  getScoreMessage,
} from "@/utils/colorScore";
import { feedbackForScore, impact } from "@/utils/haptics";
import { playScoreSound } from "@/utils/sound";

/**
 * El reto diario, jugándose.
 *
 * El bucle es exactamente el de `app/game.tsx` —logo, rueda, comprobar, hoja de
 * resultado— con una diferencia que viene de las reglas del plan:
 *
 * **La puntuación que vale es la del servidor.** El backend recalcula el
 * intento entero al cerrarlo (regla 6.1) y es la suya la que entra en la
 * clasificación; la app se limita a mandar los colores elegidos.
 *
 * ## Por qué SÍ se puede enseñar el acierto de cada ronda
 *
 * Antes esta pantalla no daba ningún resultado por ronda, con el argumento de
 * que el color objetivo no llega hasta cerrar el intento (regla 6.2). Eso
 * confundía dos cosas distintas:
 *
 *  - Lo que la **API** no manda antes de tiempo: cierto, `DailyRound` solo trae
 *    `assetId` y `colorIndex`.
 *  - Lo que la **app** tiene: el catálogo local, que sí lleva los colores de
 *    los 137 logos. `findAsset(assetId).colors[colorIndex]` es el objetivo, y
 *    es de donde el modo offline saca el suyo desde siempre.
 *
 * Es decir: el color ya viajaba en el bundle, así que callárselo no protegía
 * nada — solo dejaba al jugador cinco rondas a ciegas, sin sonido y sin saber
 * si iba bien, en el mismo juego que sin conexión le contesta al instante. La
 * regla que de verdad importa —que el cliente no decida la puntuación— se
 * respeta igual: esto es feedback, no marcador.
 *
 * La cifra de cada ronda sale de `calculateColorScore`, la misma función del
 * modo offline. Si algún día el backend puntuase con otra fórmula, estos
 * porcentajes y el total del desglose final dejarían de cuadrar; hoy la
 * autoridad sigue siendo el desglose del servidor, que es el que se enseña al
 * terminar.
 */
/**
 * Pausa entre comprobar y abrir la hoja de resultado.
 *
 * El logo pulsa al aplicar el color, y la hoja tiene que llegar después de ese
 * pulso: si sale encima, el jugador no llega a ver aplicado el color que acaba
 * de elegir. Mismo valor y mismo motivo que el `RESULT_DELAY_MS` de
 * `app/game.tsx`.
 */
const RESULT_DELAY_MS = 260;

/** Lo que hay que enseñar de la ronda recién cerrada. */
interface RoundOutcome {
  score: number;
  message: string;
  targetHex: string;
  yourHex: string;
  delta: ReturnType<typeof getHSVDelta>;
}

export default function DailyPlayScreen(): ReactElement {
  const router = useRouter();
  // Mismo parámetro que la antesala: el reto es de un grupo concreto.
  const { group: groupParam } = useLocalSearchParams<{ group?: string }>();
  const groupId = Array.isArray(groupParam) ? groupParam[0] : (groupParam ?? null);
  const daily = useDailyChallenge(groupId);

  const wheelRef = useRef<ColorWheelHandle>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [animationToken, setAnimationToken] = useState(0);
  /**
   * Entre el pulso y el cambio de ronda no se admite otro toque.
   *
   * El estado es lo que deshabilita el botón; la referencia es lo que de verdad
   * cierra la puerta. Dos toques en el mismo fotograma leen los dos
   * `checking === false` —el repintado que lo pone a `true` aún no ha
   * ocurrido—, así que la comprobación tenía que salir del estado. Sin esto,
   * en la última ronda los dos toques respondían la ronda y disparaban el
   * cierre del intento.
   */
  const checkingRef = useRef(false);
  const [checking, setChecking] = useState(false);

  /** El desglose de la ronda recién cerrada, y si su hoja está abierta. */
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null);
  const [resultVisible, setResultVisible] = useState(false);

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
    levelBefore,
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

  /**
   * La ronda en pantalla es la dueña de la guarda.
   *
   * Reabrirla a mano en cada sitio que avanza —el temporizador, el segundo
   * intento, un reto nuevo que llega al recargar— era pedir que algún camino se
   * quedase sin reabrirla y dejase el tablero muerto. Colgándola de la ronda
   * hay una sola regla: **cambia la ronda, se admite otro toque**. La última no
   * cambia a ninguna, así que tras enviar el intento la guarda se queda echada
   * sola, que es justo lo que se quiere.
   */
  useEffect(() => {
    checkingRef.current = false;
  }, [currentRound?.round]);

  /**
   * El desglose del intento se guarda en el teléfono al cerrarlo.
   *
   * Es la única vez que las rondas —color enviado y acierto de cada una—
   * viajan: ni `daily.overview()` ni `daily.today()` las traen. Sin guardarlas,
   * al volver al menú el anillo de rondas no tendría con qué pintarse.
   *
   * Va aquí, colgado del resultado, y no dentro de `submit`: el hook se ocupa
   * de hablar con la API y esto es una decisión de presentación del menú.
   */
  useEffect(() => {
    if (result == null || groupId == null || status == null) {
      return;
    }
    void saveAttempt(
      groupId,
      status.challenge.challengeDate,
      result.attempt.rounds.map((round) => ({
        answerHex: round.answer.hex,
        accuracy: round.accuracy,
      })),
    );
    // Y lo que este intento ha dado de XP, que el perfil suma para poder decir
    // cuánto has subido hoy. `GET /me` solo trae el total de siempre.
    void addDailyXp(status.challenge.challengeDate, result.xpEarned);
  }, [result, groupId, status]);

  /**
   * Destino de la vuelta: la ficha del grupo cuyo reto se está jugando.
   *
   * Antes era la antesala `/online/daily?group=…`, que ya no existe como
   * pantalla. Se vuelve al sitio del que se vino y donde está la clasificación,
   * que es justo lo que se quiere mirar después de enviar un intento.
   *
   * Sin grupo —enlace directo o recarga en web— se vuelve a la lista: no hay
   * ficha a la que ir.
   */
  const dailyHref: Href = useMemo(
    () =>
      groupId
        ? { pathname: "/online/groups/[id]" as const, params: { id: groupId } }
        : "/online/groups",
    [groupId],
  );

  const back = useCallback(() => {
    // `replace` y no `back`: al terminar el intento no tiene sentido que el
    // gesto de volver devuelva a un tablero que ya se ha enviado.
    router.replace(dailyHref);
  }, [dailyHref, router]);

  const handleColorChange = useCallback(
    (hsv: HSVColor): void => {
      setSelectedHSV(hsv);
    },
    [setSelectedHSV],
  );

  /**
   * Cierra la ronda en pantalla y pasa a la siguiente —o envía el intento.
   *
   * La respuesta quedó fijada al pulsar «comprobar», así que mover la rueda
   * mientras la hoja está abierta ya no cambia nada.
   */
  const advance = useCallback((): void => {
    setChecking(false);
    if (!answerCurrent()) {
      // Era la última ronda: se cierra el intento y la guarda se queda echada,
      // porque ya no hay ronda a la que avanzar que la reabra.
      void submit();
      return;
    }
    // La rueda es no controlada: se reposiciona por referencia (ver
    // `components/ColorWheel.tsx`).
    wheelRef.current?.setColor(INITIAL_HSV);
  }, [answerCurrent, submit]);

  const handleCheck = useCallback((): void => {
    if (checkingRef.current) {
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    // El pulso del logo confirma que el color se aplicó. Va antes que la hoja
    // para que el jugador llegue a ver su propia elección puesta en el dibujo.
    setAnimationToken((value) => value + 1);

    /**
     * El color a acertar, del catálogo que la app ya trae.
     *
     * `colorIndex` lo manda el SERVIDOR y se usa tal cual: el
     * `editableColorIndex` del catálogo local no siempre coincide.
     */
    const target = currentRound?.asset?.colors[currentRound.colorIndex] ?? null;

    if (target == null) {
      /*
        El servidor mandó un logo que esta versión de la app no tiene, o un
        índice que su catálogo no cubre. Sin color no hay nada que comparar, así
        que se conserva el comportamiento de antes —un pulso y a la siguiente—
        en vez de enseñar un 0 % que sería mentira. El intento sigue siendo
        válido: lo puntúa el servidor igual.
      */
      impact("light");
      advanceTimer.current = setTimeout(advance, RESULT_DELAY_MS);
      return;
    }

    const score = calculateColorScore(selectedHSV, target.hsv);

    setRoundOutcome({
      score,
      message: t(getScoreMessage(score)),
      targetHex: target.hex,
      yourHex: selectedColor,
      delta: getHSVDelta(selectedHSV, target.hsv),
    });

    // El mismo par que el modo offline: la vibración dice cómo de cerca has
    // estado antes de que dé tiempo a leer la cifra, y el sonido la remata.
    feedbackForScore(score);
    playScoreSound(score);

    advanceTimer.current = setTimeout(() => {
      setResultVisible(true);
    }, RESULT_DELAY_MS);
  }, [advance, currentRound, selectedColor, selectedHSV]);

  const handleNextRound = useCallback((): void => {
    setResultVisible(false);
    advance();
  }, [advance]);

  // -- Carga y errores duros -------------------------------------------------

  if (loading && !status) {
    return (
      <Screen
        eyebrow={t("online.daily.badge")}
        title={t("online.daily.title")}
        backTo={dailyHref}
        scrollable={false}
        contentStyle={styles.centered}
      >
        {error ? (
          <ErrorBanner
            message={error}
            onRetry={() => void daily.reload()}
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
        levelBefore={levelBefore}
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
        backTo={dailyHref}
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
              // Ambar: reintentar pide atencion sin ser un error en si mismo.
              tone="amber"
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
        backTo={dailyHref}
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
    <>
      <PlayBoard
        backHref={dailyHref}
        round={currentRound}
        roundIndex={roundIndex}
        totalRounds={rounds.length}
        attemptNumber={(status?.attemptsUsed ?? 0) + 1}
        selectedColor={selectedColor}
        selectedHSV={selectedHSV}
        animationToken={animationToken}
        checking={checking || resultVisible}
        wheelRef={wheelRef}
        onColorChange={handleColorChange}
        onCheck={handleCheck}
      />

      {/*
        La hoja de resultado de la ronda: la misma que el modo offline, para que
        cerrar una imagen se sienta igual con conexión y sin ella.

        No se puede descartar tocando fuera —lo impide `Sheet`—, así que el
        único camino a la ronda siguiente pasa por su botón. Eso es lo que
        mantiene una sola vía de avance y evita que el tablero se quede con la
        hoja abierta y la ronda ya cambiada por debajo.
      */}
      {roundOutcome ? (
        <ResultSheet
          visible={resultVisible}
          score={roundOutcome.score}
          message={roundOutcome.message}
          targetColor={roundOutcome.targetHex}
          yourColor={roundOutcome.yourHex}
          delta={roundOutcome.delta}
          onNext={handleNextRound}
          nextLabel={
            roundIndex === rounds.length - 1
              ? t("online.daily.finish")
              : undefined
          }
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tablero
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface PlayBoardProps {
  /** Destino de reserva de la flecha, con el grupo puesto. Ver `dailyHref`. */
  backHref: Href;
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
  backHref,
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
      backTo={backHref}
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
            <MissingAsset
              assetId={round.assetId}
              round={round.round}
              size={challengeSize}
            />
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

      {/*
        Neutro, y es obligatorio: aqui hay una muestra de color del juego en
        pantalla, y es la que hay que mirar. Ver la regla del pigmento en
        `design/Button.tsx` — dentro de una ronda, el boton no compite.
      */}
      <Button
        label={t(isLast ? "online.daily.finish" : "online.daily.check")}
        tone="neutral"
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
  round,
  size,
}: {
  assetId: string;
  round: number;
  size: number;
}): ReactElement {
  return (
    <View style={[styles.missing, { width: size, height: size }]}>
      <Text style={[Type.bodyStrong, styles.centeredText]}>
        {t("online.daily.missingAsset")}
      </Text>
      {/*
        El identificador solo en desarrollo. Es el nombre de la marca, así que
        enseñárselo al jugador en producción sería regalarle la respuesta justo
        en el caso en que no puede ver el dibujo — que es cuando más tentado
        estaría de buscarla. Para depurar sí hace falta saber qué logo faltó.
      */}
      <Text style={[Type.caption, styles.centeredText]}>
        {__DEV__ ? assetId : t("online.daily.roundImage", { round })}
      </Text>
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
  levelBefore,
  canRetry,
  onRetry,
  onFinish,
}: {
  result: DailySubmitResult;
  /** El nivel de antes de enviar. Ver `levelBefore` en `useDailyChallenge`. */
  levelBefore: number | null;
  canRetry: boolean;
  onRetry: () => void;
  onFinish: () => void;
}): ReactElement {
  const [detail, setDetail] = useState<DailyRoundResult | null>(null);

  const improved = result.attempt.score >= result.best;
  /**
   * Subir de nivel es la única noticia de esta pantalla que no cabe en una
   * cifra, así que se dice con todas las letras y solo cuando pasa. El resto de
   * los días, el XP se lee en su renglón y ya está.
   */
  const leveledUp = levelBefore != null && result.level > levelBefore;

  return (
    <>
      <Screen
        eyebrow={t("online.daily.badge")}
        title={t("online.daily.resultTitle")}
        subtitle={t("online.daily.attemptValue", {
          number: result.attempt.attemptNumber,
        })}
        /*
          El mismo fondo que los marcadores de una partida en grupo, y por el
          mismo motivo: esto es una pantalla de resultado, con tarjetas, cifras
          y un desglose de cinco filas. Los orbes de la portada son manchas
          enormes pensadas para llenar una pantalla vacía, y aquí se leerían
          como niebla por debajo del texto. La constelación son aros de un píxel
          y puntos repartidos por los bordes, donde el contenido no llega: se
          reconocen como los círculos del logo y no le quitan contraste a
          ninguna cifra.
        */
        backdrop={<ResultConstellation />}
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

          {leveledUp ? (
            <Notice message={t("online.daily.levelUp", { level: result.level })} />
          ) : null}
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
              tone={SECTION_TONE.today}
              onPress={onRetry}
            />
          ) : null}
          <Button
            label={t("online.daily.finishAttempt")}
            icon="home"
            variant={canRetry ? "secondary" : "primary"}
            // Solo lo lee cuando es el primario: da por terminado el intento.
            tone="green"
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
        {/* El identificador del logo era el nombre de la marca —«lacoste»—, es
            decir media respuesta escrita en la fila del desglose. La ronda ya
            la identifica igual de bien y no cuenta nada. */}
        <Text style={Type.bodyStrong} numberOfLines={1}>
          {t("online.daily.roundImage", { round: detail.round })}
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
