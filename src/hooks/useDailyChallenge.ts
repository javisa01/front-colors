import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, ApiErrorCode, describeError } from "@/api/errors";
import type {
  DailyAnswer,
  DailyStatus,
  DailySubmitResult,
} from "@/api/types";
import { findAsset } from "@/online/daily";
import { readDailyStatus, writeDailyStatus } from "@/online/dailyCache";
import { useSession } from "@/online/session";
// Del hook offline se toma SOLO el color de arranque de la rueda, para que el
// punto de partida sea el mismo en los dos modos. Todo lo demás de
// `useChallenge` es justo lo que aquí no vale: elige los logos en local, con el
// `editableColorIndex` del catálogo y un barajado propio. En el reto diario los
// manda el servidor (regla 6.2 del plan) y decidirlos aquí daría una partida
// distinta a la que se está puntuando.
import { INITIAL_HSV } from "@/hooks/useChallenge";
import type { ChallengeMetadata, HSVColor } from "@/types/challenge";
import { hsvToHex } from "@/utils/color";

/**
 * El reto diario, de principio a fin.
 *
 * Carga la jornada, casa cada ronda con su dibujo del catálogo local, lleva el
 * bucle de juego y cierra el intento contra el servidor.
 *
 * Tres reglas del plan se notan en el diseño de este hook:
 *
 *  - **El reto es de un grupo** y hay uno por grupo y jornada, con imágenes
 *    distintas. El hook recibe el grupo y no lo elige; sin grupo no hay reto.
 *  - **Los logos y el color a adivinar los manda el servidor** (6.2). Aquí solo
 *    se busca el dibujo por `assetId` y se pinta el color `colorIndex` que
 *    llega; nunca se elige nada.
 *  - **El color objetivo no se conoce hasta cerrar el intento** (6.2). El
 *    catálogo local lo tiene, pero no se lee: la respuesta correcta aparece con
 *    el desglose que devuelve el `POST`, y no antes.
 *  - **La puntuación la calcula el servidor** (6.1). El hook manda los colores
 *    elegidos y no puntúa nada por su cuenta.
 */

/** Una ronda del servidor con su dibujo ya resuelto. */
export interface DailyRoundView {
  /** 1-based, tal y como lo numera el servidor. */
  round: number;
  assetId: string;
  /** Qué color del logo hay que adivinar. **Lo decide el servidor.** */
  colorIndex: number;
  /** El dibujo, o `null` si este logo no está en el catálogo de la app. */
  asset: ChallengeMetadata | null;
}

export interface UseDailyChallengeResult {
  // -- Estado de la jornada -------------------------------------------------
  loading: boolean;
  error: string | null;
  status: DailyStatus | null;
  rounds: DailyRoundView[];
  attemptsLeft: number;
  /**
   * El servidor ha dicho que la jornada que teníamos en pantalla ya cerró.
   * La cuenta atrás local es un adorno; la autoridad es esto.
   */
  serverClosed: boolean;
  /**
   * `false` si el reloj del teléfono no cae dentro de la ventana del reto. Pasa
   * con el viaje en el tiempo del backend (5.5) o con la hora del móvil mal
   * puesta, y entonces la cuenta atrás local no significa nada y se calla.
   */
  clockTrusted: boolean;
  reload: () => Promise<void>;

  // -- Bucle de juego -------------------------------------------------------
  roundIndex: number;
  currentRound: DailyRoundView | null;
  selectedHSV: HSVColor;
  /** Derivado de `selectedHSV`, solo para pintar. Nunca se reconvierte. */
  selectedColor: string;
  setSelectedHSV: (hsv: HSVColor) => void;
  /**
   * Cierra la ronda actual y avanza. Devuelve `true` si aún quedan rondas y
   * `false` cuando la última acaba de responderse: entonces toca `submit()`.
   */
  answerCurrent: () => boolean;

  // -- Cierre del intento ---------------------------------------------------
  submitting: boolean;
  submitError: string | null;
  result: DailySubmitResult | null;
  /**
   * Envía las respuestas guardadas. Se puede volver a llamar si falló la red:
   * las respuestas no se pierden.
   */
  submit: () => Promise<void>;
  /**
   * El nivel que tenías **antes** de enviar este intento, o `null` si todavía
   * no has enviado ninguno.
   *
   * Existe porque `DailySubmitResult` trae el nivel resultante pero no dice si
   * ha cambiado, y para cuando la pantalla del resultado se pinta, el perfil de
   * la sesión ya se ha refrescado con el nuevo: comparar contra él diría
   * siempre que no. Se captura al empezar el envío, que es el único momento en
   * que el nivel anterior sigue siendo el vigente.
   */
  levelBefore: number | null;
  /** Prepara otro intento con el mismo reto, sin recargar la pantalla. */
  restart: () => void;
}

export function useDailyChallenge(groupId: string | null): UseDailyChallengeResult {
  const { api, user, reloadUser } = useSession();

  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clockTrusted, setClockTrusted] = useState(false);
  const [serverClosed, setServerClosed] = useState(false);

  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedHSV, setSelectedHSVState] = useState<HSVColor>(INITIAL_HSV);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<DailySubmitResult | null>(null);
  /** Ver `levelBefore` en la interfaz: el nivel de antes de enviar. */
  const [levelBefore, setLevelBefore] = useState<number | null>(null);

  /**
   * Las respuestas viven en una referencia, no en el estado.
   *
   * `answerCurrent()` y el envío ocurren en el mismo gesto —responder la última
   * ronda cierra el intento—, y un `setState` no se ve dentro del mismo ciclo.
   * Leyendo de la referencia, lo que se manda incluye siempre la última
   * respuesta. Es el mismo motivo por el que `game.tsx` guarda `scoresRef`.
   */
  const answersRef = useRef<DailyAnswer[]>([]);
  /** El reto al que pertenecen esas respuestas, para mandarlo en el `POST`. */
  const challengeIdRef = useRef<string | null>(null);
  /**
   * Cierra el paso a un segundo `POST` mientras el primero está en vuelo.
   *
   * `submitting` es estado, y el estado se lee viejo dentro del mismo
   * fotograma: dos toques seguidos al botón de reintentar de la pantalla de
   * error salían los dos, y el servidor los contaba como **dos intentos** de la
   * jornada —de los dos que hay al día—. Una referencia se ve escrita al
   * instante, así que el segundo se cae aquí y no llega a salir.
   */
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Carga la jornada. **No se dispara sola**: la lanzan las pantallas desde su
   * `useFocusEffect`, como el resto del árbol online. Así se relee al volver de
   * la partida —los intentos y la mejor puntuación han cambiado— y no hay dos
   * peticiones al montar, una del hook y otra de la pantalla.
   */
  const load = useCallback(async () => {
    if (!groupId) {
      // Sin grupo no hay reto que cargar. La pantalla ya se encarga de mandar
      // al jugador a elegir uno; aquí basta con no pedir nada.
      setLoading(false);
      return;
    }

    setError(null);
    try {
      // Solo el reto. La lista de grupos se pedía aquí para decir en cuáles
      // sumaba la puntuación, y con un reto por grupo esa pregunta ya no
      // existe: suma en el suyo y en ninguno más. El propio reto trae el
      // nombre del grupo, así que era una petición por pantalla para nada.
      const today = await api.daily.today(groupId);

      if (!mountedRef.current) {
        return;
      }

      setStatus(today);
      setServerClosed(false);
      // Para que la próxima visita a este grupo salga llena sin esperar.
      void writeDailyStatus(groupId, today);

      // Si el reto que acaba de llegar no contiene al reloj del teléfono, los
      // dos relojes no están de acuerdo y la cuenta atrás local sobra.
      const now = Date.now();
      setClockTrusted(
        now >= new Date(today.challenge.opensAt).getTime() &&
          now < new Date(today.challenge.closesAt).getTime(),
      );

      // Un reto nuevo invalida cualquier intento a medias.
      if (challengeIdRef.current !== today.challenge.id) {
        challengeIdRef.current = today.challenge.id;
        answersRef.current = [];
        setRoundIndex(0);
        setResult(null);
        setSubmitError(null);
        setSelectedHSVState(INITIAL_HSV);
      }
    } catch (loadError) {
      if (mountedRef.current) {
        setError(describeError(loadError));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [api, groupId]);

  /**
   * Siembra la pantalla con lo último que dijo el servidor, guardado en el
   * teléfono.
   *
   * Se pinta **antes** de que llegue la red, y la red lo sustituye al llegar.
   * `current ?? cached` es la guarda que importa: si la respuesta de verdad se
   * ha adelantado a la lectura del disco, lo guardado no la pisa.
   *
   * La caché caduca sola comparando con el `closesAt` que trae dentro, así que
   * esto no puede enseñar la jornada de ayer. Ver `online/dailyCache`.
   */
  useEffect(() => {
    if (!groupId) {
      return;
    }
    let active = true;

    void (async () => {
      const cached = await readDailyStatus(groupId);
      if (!active || !cached) {
        return;
      }
      setStatus((current) => current ?? cached);
      // Ya hay algo que enseñar: seguir diciendo «cargando» sobre una tarjeta
      // llena es mentir sobre el estado de la pantalla.
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [groupId]);

  const rounds = useMemo<DailyRoundView[]>(
    () =>
      (status?.challenge.rounds ?? []).map((round) => ({
        round: round.round,
        assetId: round.assetId,
        // El índice llega del servidor y se usa tal cual: el
        // `editableColorIndex` del catálogo local no siempre coincide (`fanta`
        // dice 3 y solo tiene 3 colores; el backend lo recorta a 0).
        colorIndex: round.colorIndex,
        asset: findAsset(round.assetId),
      })),
    [status],
  );

  const currentRound = rounds[roundIndex] ?? null;

  const selectedColor = useMemo(
    () => hsvToHex(selectedHSV.h, selectedHSV.s, selectedHSV.v),
    [selectedHSV],
  );

  const setSelectedHSV = useCallback((hsv: HSVColor): void => {
    setSelectedHSVState(hsv);
  }, []);

  const answerCurrent = useCallback((): boolean => {
    if (!currentRound) {
      return false;
    }

    answersRef.current = [
      ...answersRef.current.filter(
        (answer) => answer.round !== currentRound.round,
      ),
      { round: currentRound.round, hsv: selectedHSV },
    ];

    const hasMore = roundIndex < rounds.length - 1;
    if (hasMore) {
      setRoundIndex((value) => value + 1);
      setSelectedHSVState(INITIAL_HSV);
    }
    return hasMore;
  }, [currentRound, roundIndex, rounds.length, selectedHSV]);

  const submit = useCallback(async (): Promise<void> => {
    const challengeId = challengeIdRef.current;
    if (!challengeId || !groupId || answersRef.current.length === 0) {
      return;
    }
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;

    // El nivel de ahora mismo, antes de que el intento lo mueva. Se guarda aquí
    // porque en cuanto vuelva la respuesta se refresca el perfil de la sesión y
    // este número deja de estar en ninguna parte.
    setLevelBefore(user?.level ?? null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const submitted = await api.daily.submit({
        groupId,
        challengeId,
        answers: answersRef.current,
      });

      if (!mountedRef.current) {
        return;
      }
      setResult(submitted);
      // El servidor ya ha dicho cómo queda la jornada: se refleja sin pedir
      // otra vez `GET /daily`.
      setStatus((previous) =>
        previous
          ? {
              ...previous,
              attemptsUsed: submitted.attemptsUsed,
              attemptsLeft: submitted.attemptsLeft,
              bestScore: submitted.best,
            }
          : previous,
      );
      // El XP y el nivel han cambiado: que el resto de la app se entere.
      void reloadUser().catch(() => undefined);
    } catch (error_) {
      if (!mountedRef.current) {
        return;
      }
      if (
        error_ instanceof ApiError &&
        error_.code === ApiErrorCode.DAILY_CLOSED
      ) {
        setServerClosed(true);
      }
      setSubmitError(describeError(error_));
    } finally {
      // Se libera pase lo que pase y aunque la pantalla ya no esté montada: si
      // el envío falló, la pantalla de error ofrece reintentar y ese botón
      // tiene que volver a funcionar.
      submittingRef.current = false;
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }, [api, groupId, reloadUser, user]);

  const restart = useCallback((): void => {
    answersRef.current = [];
    setRoundIndex(0);
    setSelectedHSVState(INITIAL_HSV);
    setResult(null);
    setSubmitError(null);
  }, []);

  return {
    loading,
    error,
    status,
    rounds,
    attemptsLeft: status?.attemptsLeft ?? 0,
    serverClosed,
    clockTrusted,
    reload: load,

    roundIndex,
    currentRound,
    selectedHSV,
    selectedColor,
    setSelectedHSV,
    answerCurrent,

    submitting,
    submitError,
    result,
    submit,
    levelBefore,
    restart,
  };
}

/**
 * Cuenta atrás a un instante ISO, refrescada cada segundo.
 *
 * Vive aquí y no en `online/daily.ts` porque es estado de React, y separada de
 * `useDailyChallenge` para que el reloj solo corra en las pantallas que lo
 * enseñan: durante la partida no hay ninguna cuenta atrás —el reto diario es
 * asíncrono y no tiene cronómetro— y un `setState` por segundo repintaría el
 * tablero para nada.
 */
export function useCountdown(
  target: string | null,
  enabled = true,
): { remainingMs: number; expired: boolean } {
  const [now, setNow] = useState(() => Date.now());

  const targetMs = useMemo(
    () => (target ? new Date(target).getTime() : Number.NaN),
    [target],
  );

  const running = enabled && !Number.isNaN(targetMs);
  const remainingMs = running ? Math.max(0, targetMs - now) : 0;
  const expired = running && remainingMs === 0;

  useEffect(() => {
    if (!running || expired) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running, expired]);

  return { remainingMs, expired };
}
