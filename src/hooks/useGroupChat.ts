import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { describeError } from "@/api/errors";
import type { ChatMessage } from "@/api/types";
import { t } from "@/i18n";
import {
  CHAT_PAGE_SIZE,
  MESSAGE_MAX_LENGTH,
  POLL_BACKOFF_MS,
  POLL_INTERVAL_MS,
  isPendingId,
  pendingId,
  toItem,
  type ChatItem,
} from "@/online/chat";
import { useSession } from "@/online/session";

/**
 * La conversación de un grupo: cargarla, sondearla y escribir en ella.
 *
 * ## El sondeo, que es lo único delicado de aquí
 *
 * No hay WebSocket (decisión cerrada del plan): lo nuevo se pide cada cinco
 * segundos con `after=<id del último mensaje>`. Eso obliga a una regla que este
 * hook cumple de forma explícita y no como efecto secundario:
 *
 * **el sondeo solo corre si la pantalla tiene el foco Y la app está en primer
 * plano.** Las dos condiciones, no una. `useFocusEffect` cubre navegar a otra
 * pantalla; `AppState` cubre bloquear el móvil o cambiar de aplicación, que es
 * el caso que se escapa —la pantalla sigue montada y «enfocada» dentro de una
 * app que nadie está mirando—. Sin la segunda, un chat abierto en el bolsillo
 * pide 720 veces por hora: gasta batería y se come el limitador de ritmo del
 * servidor para cuando de verdad haga falta.
 *
 * El bucle es una cadena de `setTimeout`, no un `setInterval`: así una petición
 * lenta nunca se solapa con la siguiente, y el propio ciclo puede cambiar de
 * ritmo —inmediato si el servidor dice que queda página por traer, más lento
 * tras un fallo— sin montar un segundo temporizador.
 *
 * ## Los mensajes que aún vuelan
 *
 * Lo que se escribe aparece al instante en el `outbox` y solo pasa a la
 * conversación cuando el servidor lo confirma. Van en dos listas separadas a
 * propósito: así lo pendiente se queda **siempre al final**, que es donde se
 * escribe, en vez de flotar hacia arriba a medida que entran mensajes de otros.
 *
 * ## Lo que este hook NO mira
 *
 * El estado de la temporada. Un grupo terminado sigue siendo un sitio donde
 * hablar (regla 5.2.1 del plan) y el servidor tampoco lo comprueba: la única
 * guarda del chat, aquí y allí, es la pertenencia al grupo.
 */

export interface UseGroupChatResult {
  /** La conversación entera, **del más nuevo al más viejo**, con lo pendiente. */
  items: ChatItem[];
  /** Primera carga. Después de ella la lista ya no se vacía nunca. */
  loading: boolean;
  /** Fallo de la carga inicial: no hay nada que enseñar. */
  error: string | null;
  /**
   * El sondeo no está llegando. La conversación que ya está en pantalla sigue
   * siendo válida, así que esto es un aviso, no un error que la sustituya.
   */
  stale: boolean;
  /** Queda conversación más arriba. */
  hasMore: boolean;
  loadingOlder: boolean;
  /** Trae una página más de historial hacia arriba. */
  loadOlder: () => void;
  /** Recarga desde cero. Es el botón de reintentar de la carga inicial. */
  reload: () => Promise<void>;
  /** Encola un mensaje. Devuelve `false` si el texto no era enviable. */
  send: (body: string) => boolean;
  /** Vuelve a intentar un mensaje que no llegó. */
  retry: (id: string) => void;
  /** Tira un mensaje que no llegó. */
  discard: (id: string) => void;
  /** El último fallo al enviar, ya traducido. */
  sendError: string | null;
  /**
   * El mensaje confirmado más nuevo. Es lo que la pantalla anota como leído.
   *
   * Sale de la lista del servidor y **nunca** del `outbox`: un mensaje que aún
   * vuela lleva un id temporal que no significa nada fuera de este teléfono.
   */
  newestId: string | null;
}

export function useGroupChat(groupId: string | null): UseGroupChatResult {
  const { api, user } = useSession();

  /** Lo confirmado por el servidor, del más nuevo al más viejo. */
  const [items, setItems] = useState<ChatItem[]>([]);
  /** Lo que aún vuela o no llegó, en el orden en que se escribió. */
  const [outbox, setOutbox] = useState<ChatItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  /**
   * El cursor del sondeo: el mensaje confirmado más nuevo.
   *
   * Va en una referencia y no en las dependencias del efecto a propósito. Si el
   * bucle dependiera de `items`, cada mensaje que entra desmontaría el
   * temporizador y montaría otro, y el ritmo real del sondeo dejaría de ser el
   * declarado en cuanto la conversación se animase.
   */
  const cursorRef = useRef<string | null>(null);
  useEffect(() => {
    cursorRef.current = items[0]?.id ?? null;
  }, [items]);

  /** Contador de ids temporales. No sale del teléfono. */
  const seedRef = useRef(0);

  // -------------------------------------------------------------------------
  // Carga
  // -------------------------------------------------------------------------

  const reload = useCallback(async () => {
    if (!groupId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await api.chat.history(groupId, { limit: CHAT_PAGE_SIZE });
      setItems(page.messages.map(toItem));
      setHasMore(page.hasMore);
      setStale(false);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  }, [api, groupId]);

  const loadOlder = useCallback(() => {
    if (!groupId || !hasMore || loadingOlder) {
      return;
    }
    const oldest = items[items.length - 1];
    if (!oldest) {
      return;
    }

    setLoadingOlder(true);
    void (async () => {
      try {
        const page = await api.chat.history(groupId, {
          before: oldest.id,
          limit: CHAT_PAGE_SIZE,
        });
        setItems((prev) => {
          const known = new Set(prev.map((item) => item.id));
          const older = page.messages
            .filter((message) => !known.has(message.id))
            .map(toItem);
          return older.length > 0 ? [...prev, ...older] : prev;
        });
        setHasMore(page.hasMore);
      } catch {
        // El historial viejo puede esperar: no se rompe la pantalla por no
        // haber podido subir un poco más. El siguiente tirón lo reintenta.
      } finally {
        setLoadingOlder(false);
      }
    })();
  }, [api, groupId, hasMore, items, loadingOlder]);

  // -------------------------------------------------------------------------
  // Sondeo
  // -------------------------------------------------------------------------

  /** La pantalla está delante. Se apaga al navegar a cualquier otro sitio. */
  const [focused, setFocused] = useState(false);

  /**
   * De qué grupo es la conversación que ya está cargada.
   *
   * La carga inicial cuelga del foco, como el resto del árbol online, y no de
   * un `useEffect` al montar: así el hook no pide nada mientras la pantalla no
   * esté delante, que es la misma regla que gobierna el sondeo. La referencia
   * evita además volver a traerse la conversación entera cada vez que se
   * recupera el foco: de ponerla al día ya se encarga el sondeo, y sin tirar el
   * sitio por el que se estaba leyendo.
   */
  const loadedForRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (groupId && loadedForRef.current !== groupId) {
        loadedForRef.current = groupId;
        void reload();
      }
      return () => setFocused(false);
    }, [groupId, reload]),
  );

  /**
   * La app está en primer plano. `inactive` (iOS, al deslizar el conmutador de
   * apps o con una llamada encima) cuenta como fondo: si no se ve, no se sondea.
   */
  const [foreground, setForeground] = useState(
    () => AppState.currentState === "active",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);

  /**
   * Mete en la conversación lo que traiga el sondeo, en orden cronológico.
   *
   * Además retira del `outbox` el eco de lo propio: si el sondeo devuelve un
   * mensaje mío antes de que resuelva su `POST`, sin esto se vería dos veces
   * durante unos milisegundos.
   */
  const absorb = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) {
      return;
    }
    setItems((prev) => {
      const known = new Set(prev.map((item) => item.id));
      const fresh = incoming
        .filter((message) => !known.has(message.id))
        .map(toItem)
        .reverse();
      return fresh.length > 0 ? [...fresh, ...prev] : prev;
    });
    setOutbox((prev) =>
      prev.filter(
        (queued) =>
          queued.state !== "pending" ||
          !incoming.some(
            (message) =>
              message.author.userId === queued.author.userId &&
              message.body === queued.body,
          ),
      ),
    );
  }, []);

  const polling = groupId != null && focused && foreground && !loading;

  useEffect(() => {
    if (!polling || !groupId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number): void => {
      if (!cancelled) {
        timer = setTimeout(() => void tick(), delay);
      }
    };

    const tick = async (): Promise<void> => {
      const cursor = cursorRef.current;
      if (!cursor) {
        // Conversación vacía: no hay `after` que mandar. Se vuelve a mirar al
        // ritmo normal, y el primer mensaje que se escriba dará el cursor.
        schedule(POLL_INTERVAL_MS);
        return;
      }
      try {
        const page = await api.chat.since(groupId, cursor, CHAT_PAGE_SIZE);
        if (cancelled) {
          return;
        }
        absorb(page.messages);
        setStale(false);
        // `hasMore` en el modo `after` significa que la página se ha llenado y
        // quedan mensajes aún más nuevos: se encadena sin esperar, que es lo
        // que hace que volver del fondo con la conversación disparada no tarde
        // un minuto en ponerse al día.
        schedule(page.hasMore ? 0 : POLL_INTERVAL_MS);
      } catch {
        if (cancelled) {
          return;
        }
        setStale(true);
        schedule(POLL_BACKOFF_MS);
      }
    };

    // Se pregunta ya, sin esperar el primer intervalo: al entrar en la pantalla
    // o al volver del fondo, cinco segundos mirando una conversación vieja son
    // exactamente lo que no debe sentirse.
    void tick();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [absorb, api, groupId, polling]);

  // -------------------------------------------------------------------------
  // Escribir
  // -------------------------------------------------------------------------

  const deliver = useCallback(
    async (queued: ChatItem) => {
      if (!groupId) {
        return;
      }
      try {
        const { message } = await api.chat.send(groupId, queued.body);
        setOutbox((prev) => prev.filter((item) => item.id !== queued.id));
        setItems((prev) =>
          prev.some((item) => item.id === message.id)
            ? prev
            : [toItem(message), ...prev],
        );
        setSendError(null);
      } catch (deliverError) {
        setOutbox((prev) =>
          prev.map((item) =>
            item.id === queued.id ? { ...item, state: "failed" } : item,
          ),
        );
        setSendError(describeError(deliverError));
      }
    },
    [api, groupId],
  );

  const send = useCallback(
    (raw: string): boolean => {
      const body = raw.trim();
      if (body.length === 0) {
        return false;
      }
      if (!groupId || !user) {
        // Sin perfil no se puede firmar el mensaje. Pasa solo si `GET /me` falló
        // y encima no había nada en caché, pero un botón que no hace nada y no
        // dice por qué es peor que el propio fallo.
        setSendError(t("online.error.generic"));
        return false;
      }
      // El tope lo valida también el servidor; frenarlo aquí evita gastar una
      // petición —y un hueco del limitador— en algo que ya se sabe que falla.
      if (body.length > MESSAGE_MAX_LENGTH) {
        return false;
      }

      seedRef.current += 1;
      const queued: ChatItem = {
        id: pendingId(seedRef.current),
        body,
        // Provisional y solo para ordenar: el instante bueno es el que pone el
        // servidor con su `Clock`, y llega al confirmarse.
        createdAt: new Date().toISOString(),
        author: { userId: user.id, username: user.username },
        state: "pending",
      };

      setSendError(null);
      setOutbox((prev) => [...prev, queued]);
      void deliver(queued);
      return true;
    },
    [deliver, groupId, user],
  );

  const retry = useCallback(
    (id: string) => {
      if (!isPendingId(id)) {
        return;
      }
      const failed = outbox.find((item) => item.id === id);
      if (!failed || failed.state !== "failed") {
        return;
      }
      const revived: ChatItem = { ...failed, state: "pending" };
      setOutbox((prev) => prev.map((item) => (item.id === id ? revived : item)));
      setSendError(null);
      void deliver(revived);
    },
    [deliver, outbox],
  );

  const discard = useCallback((id: string) => {
    setOutbox((prev) => prev.filter((item) => item.id !== id));
    setSendError(null);
  }, []);

  /**
   * Lo pendiente va delante porque la lista es del más nuevo al más viejo, y lo
   * que se acaba de escribir es lo más nuevo que hay. Dentro del `outbox` el
   * orden se invierte por lo mismo: se guarda como se escribió.
   */
  const all = useMemo(
    () => (outbox.length > 0 ? [...outbox].reverse().concat(items) : items),
    [items, outbox],
  );

  return {
    items: all,
    newestId: items[0]?.id ?? null,
    loading,
    error,
    stale,
    hasMore,
    loadingOlder,
    loadOlder,
    reload,
    send,
    retry,
    discard,
    sendError,
  };
}
