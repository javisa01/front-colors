import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { describeError } from "@/api/errors";
import type { GroupDetail } from "@/api/types";
import { AmbientThread } from "@/design/Ambient";
import { Avatar, playerTint } from "@/design/Avatar";
import { IconButton } from "@/design/Button";
import { EmptyState, ErrorBanner, Loading, Pill } from "@/design/Feedback";
import { Icon } from "@/design/Icon";
import { Screen } from "@/design/Layout";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  DISABLED_OPACITY,
  HIT_SLOP,
  Radius,
  SECTION_TONE,
  Space,
  Type,
  type Palette,
} from "@/design/tokens";
import { useGroupChat } from "@/hooks/useGroupChat";
import { t } from "@/i18n";
import {
  MESSAGE_MAX_LENGTH,
  buildChatRows,
  formatMessageTime,
  type ChatRow,
} from "@/online/chat";
import { markSeenMessage } from "@/online/chatSeen";
import { membersLabel } from "@/online/groups";
import { useSession } from "@/online/session";

/**
 * La conversación de un grupo.
 *
 * ## El chat NO se cierra con la temporada
 *
 * Es la regla 5.2.1 del plan y la trampa más fácil de esta tanda: aquí no hay
 * ni una sola guarda que mire `group.status`. Un grupo terminado abre esta
 * pantalla igual, escribe igual y lee igual; lo único que cambia es que la
 * cabecera lo dice con todas las letras, porque quien llega desde una
 * clasificación congelada necesita saber que este sitio sigue vivo.
 *
 * ## Dónde va el color
 *
 * Esta es **la única pantalla de la app donde el contenido son personas**, y
 * por eso es la única donde el color se reparte por toda la superficie en vez
 * de reservarse para el juego. Cada burbuja lleva el tono que su autor tiene ya
 * en su avatar y en su fila de la clasificación (`playerTint`), así que una
 * conversación de cinco se lee sin ir nombre a nombre, y el chat y la
 * clasificación se reconocen como la misma gente. La propia va **maciza** con
 * tu tono, exactamente igual que tu fila del podio: es el único relleno sólido
 * de la lista y por eso se encuentra sin leerla.
 *
 * Todo lo demás —cabecera, separadores, campo de escritura— se queda en gris.
 * Si además se tiñeran, el color dejaría de señalar a nadie.
 *
 * ## La silueta
 *
 * La burbuja tiene tres esquinas redondas y una viva, y la viva **apunta a
 * quien habla**: abajo a la izquierda en lo ajeno, abajo a la derecha en lo
 * propio. Solo la lleva el último mensaje de cada intervención, así que tres
 * mensajes seguidos de la misma persona se leen como una sola forma que acaba
 * en pico. Es la misma silueta con la que la ficha del grupo anuncia el chat:
 * la entrada y el sitio al que lleva son el mismo objeto.
 */
export default function GroupChatScreen(): ReactElement {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const { api, user } = useSession();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(id) ? id[0] : (id ?? null);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);

  const {
    items,
    newestId,
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
  } = useGroupChat(groupId);

  /**
   * La ficha del grupo, solo para la cabecera.
   *
   * Cuelga del foco como el resto del árbol online, y **no se sondea**: el
   * nombre y el número de miembros no cambian mientras se conversa, así que el
   * sondeo del chat sigue siendo el único bucle de esta pantalla.
   */
  const loadGroup = useCallback(async () => {
    if (!groupId) {
      return;
    }
    try {
      const { group: detail } = await api.groups.get(groupId);
      setGroup(detail);
      setGroupError(null);
    } catch (loadError) {
      setGroupError(describeError(loadError));
    }
  }, [api, groupId]);

  useFocusEffect(
    useCallback(() => {
      void loadGroup();
    }, [loadGroup]),
  );

  /**
   * Lo que hay arriba del todo se da por leído.
   *
   * La lista es invertida, así que abrirla ya deja a la vista el final de la
   * conversación: no hay que desplazarse para haber visto lo último. Y como el
   * sondeo solo corre con la pantalla delante, lo que entra mientras se está
   * aquí también se ve. Es lo que apaga el «Sin leer» de la ficha del grupo.
   */
  useEffect(() => {
    if (!groupId || !newestId) {
      return;
    }
    void markSeenMessage(groupId, newestId);
  }, [groupId, newestId]);

  const rows = useMemo(
    () => buildChatRows(items, user?.id ?? null),
    [items, user?.id],
  );

  const listRef = useRef<FlatList<ChatRow>>(null);

  const [draft, setDraft] = useState("");

  const submit = useCallback(() => {
    if (!send(draft)) {
      return;
    }
    setDraft("");
    // La lista es invertida: el final de la conversación es el desplazamiento
    // cero. Se baja siempre al escribir, porque quien acaba de mandar algo
    // quiere verlo, esté donde esté leyendo.
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [draft, send]);

  const renderRow = useCallback(
    ({ item: row }: { item: ChatRow }) =>
      row.kind === "day" ? (
        <View style={styles.daySeparator}>
          <Pill label={row.label} />
        </View>
      ) : (
        <MessageBubble row={row} onRetry={retry} onDiscard={discard} />
      ),
    // `styles` cambia de identidad al cambiar de tema; sin él en las
    // dependencias, la fila del separador se quedaría con la hoja anterior.
    [discard, retry, styles.daySeparator],
  );

  const finished = group?.status === "finished";

  return (
    <Screen
      backTo={{ pathname: "/online/groups/[id]", params: { id: groupId ?? "" } }}
      /*
        Al grupo del que es este chat, siempre. Con `back()` se salía al menú
        de Hoy: ver `onBack` en `design/Layout`.
      */
      onBack={() =>
        router.navigate(
          groupId
            ? { pathname: "/online/groups/[id]", params: { id: groupId } }
            : "/online/groups",
        )
      }
      scrollable={false}
      backdrop={<AmbientThread />}
      contentStyle={styles.shell}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        /*
          La pantalla vive dentro del `SafeAreaView` de `Screen`, que ya ha
          desplazado el contenido por la zona segura de arriba. Este componente
          mide su hueco respecto a su padre y no respecto a la pantalla, así que
          sin compensar ese desplazamiento acolcharía de más justo esa cantidad
          y el campo de escritura se despegaría del teclado.
        */
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        {/*
          Cabecera al tamaño de una cabecera de chat, no de una portada. El
          título de 34 puntos de `Screen` se come un cuarto de la pantalla, y
          aquí lo que tiene que ocupar sitio es la conversación.
        */}
        <View style={styles.head}>
          <Text style={[Type.label, styles.eyebrow]}>
            {t("online.chat.badge")}
          </Text>
          <Text style={Type.heading} numberOfLines={1}>
            {group?.name ?? t("online.chat.title")}
          </Text>
          <Text style={[Type.caption, styles.headHint]}>
            {finished
              ? t("online.chat.finishedHint")
              : group
                ? membersLabel(group.memberCount)
                : t("online.chat.loading")}
          </Text>
        </View>

        {error ? (
          <ErrorBanner
            message={error}
            onRetry={() => void reload()}
          />
        ) : groupError && !group ? (
          <ErrorBanner message={groupError} onRetry={() => void loadGroup()} />
        ) : null}

        {/*
          El sondeo no llega. Es un aviso, no un error: lo que ya está escrito
          en pantalla se sigue leyendo, y lo que se escriba se sigue enviando.
        */}
        {stale && !error ? (
          <View style={styles.stale}>
            <Icon name="wifiOff" size={14} color={colors.text.muted} />
            <Text style={[Type.caption, styles.staleText]}>
              {t("online.chat.stale")}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <Loading label={t("online.chat.loading")} />
          </View>
        ) : rows.length === 0 ? (
          /*
            El estado vacío va FUERA de la lista. `ListEmptyComponent` dentro de
            una `FlatList` invertida se pinta también invertido —del revés,
            literalmente—, que es de esos fallos que solo se ven en el móvil.
          */
          <View style={styles.center}>
            <EmptyState
              icon="message"
              title={t("online.chat.emptyTitle")}
              hint={t("online.chat.emptyHint")}
            />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={renderRow}
            inverted
            style={styles.fill}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            /*
              En una lista invertida el «final» está arriba, así que esto es
              justo lo que dispara el historial hacia atrás con `before=`.
            */
            onEndReached={hasMore ? loadOlder : undefined}
            onEndReachedThreshold={0.4}
            /*
              Y por lo mismo el pie se pinta arriba del todo: es donde tiene que
              salir el indicador de que se está trayendo lo anterior.
            */
            ListFooterComponent={
              loadingOlder ? (
                <View style={styles.older}>
                  <Loading label={t("online.chat.loadingOlder")} />
                </View>
              ) : null
            }
          />
        )}

        {sendError ? <ErrorBanner message={sendError} /> : null}

        <Composer
          value={draft}
          onChangeText={setDraft}
          onSubmit={submit}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Una burbuja
// ---------------------------------------------------------------------------

function MessageBubble({
  row,
  onRetry,
  onDiscard,
}: {
  row: Extract<ChatRow, { kind: "message" }>;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { item, mine, leading, trailing } = row;
  const tint = playerTint(item.author.username);
  const failed = item.state === "failed";
  const pending = item.state === "pending";
  const time = formatMessageTime(item.createdAt);

  return (
    <View style={[styles.line, mine ? styles.lineMine : styles.lineTheirs]}>
      {/*
        El avatar solo en el primero de cada intervención; en los demás, un
        hueco de su ancho para que la columna de burbujas no baile. En lo propio
        no hay avatar ninguno: quien escribe ya sabe quién es, y repetirse la
        cara en cada burbuja es ruido.
      */}
      {!mine ? (
        leading ? (
          <Avatar username={item.author.username} size={28} />
        ) : (
          <View style={styles.avatarGap} />
        )
      ) : null}

      <View
        style={[styles.stack, mine ? styles.stackMine : styles.stackTheirs]}
        accessible
        accessibilityLabel={t("online.chat.messageA11y", {
          name: item.author.username,
          time,
          body: item.body,
        })}
      >
        <View
          style={[
            styles.bubble,
            {
              // La propia va maciza con tu tono, como tu fila del podio; la
              // ajena se apoya en la superficie de siempre y solo lleva el
              // color de su autor en el canto.
              backgroundColor: mine ? tint.fill : colors.surface.raised,
              borderColor: tint.border,
            },
            // El pico, solo al cerrar la intervención y del lado de quien habla.
            trailing && (mine ? styles.tailMine : styles.tailTheirs),
            pending && styles.bubblePending,
            failed && styles.bubbleFailed,
          ]}
        >
          {!mine && leading ? (
            <Text style={[Type.caption, styles.author, { color: tint.text }]}>
              {item.author.username}
            </Text>
          ) : null}
          <Text style={[Type.body, styles.body]}>{item.body}</Text>
        </View>

        {/*
          La hora cuelga bajo la última burbuja de la intervención, no dentro:
          metida en la burbuja obliga a reservarle sitio en la última línea de
          texto y parte los mensajes cortos en dos renglones para nada.
        */}
        {failed ? (
          <View style={styles.failedRow}>
            <Text style={[Type.caption, styles.failedText]}>
              {t("online.chat.failed")}
            </Text>
            <Pressable
              onPress={() => onRetry(item.id)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
            >
              <Text style={[Type.caption, styles.failedAction]}>
                {t("online.chat.retry")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onDiscard(item.id)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
            >
              <Text style={[Type.caption, styles.failedDiscard]}>
                {t("online.chat.discard")}
              </Text>
            </Pressable>
          </View>
        ) : trailing ? (
          <Text style={[Type.metricSmall, styles.time]}>
            {pending ? t("online.chat.sending") : time}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// El campo de escritura
// ---------------------------------------------------------------------------

/**
 * Un pozo con un botón redondo dentro, de la misma familia que el `Field` del
 * sistema de diseño: misma superficie hundida, mismo canto, mismo radio.
 *
 * No reutiliza `Field` porque el chat necesita dos cosas que aquel no tiene ni
 * debe tener —crecer con el texto hasta cinco renglones y llevar la acción
 * dentro— y añadírselas al campo de toda la app para usarlo en un sitio es
 * exactamente cómo un componente compartido se convierte en un cajón.
 *
 * El contador de caracteres **no está siempre**: aparece cuando queda poco. Un
 * «12/500» permanente en un chat solo dice que alguien contó los caracteres.
 */
function Composer({
  value,
  onChangeText,
  onSubmit,
  bottomInset,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  bottomInset: number;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const trimmed = value.trim();
  const over = trimmed.length - MESSAGE_MAX_LENGTH;
  const canSend = trimmed.length > 0 && over <= 0;
  /** Últimos 60 caracteres: a partir de ahí la cifra sí informa de algo. */
  const nearLimit = trimmed.length > MESSAGE_MAX_LENGTH - 60;

  return (
    <View
      style={[
        styles.composer,
        { paddingBottom: Math.max(bottomInset, Space.md) },
      ]}
    >
      {nearLimit ? (
        <Text
          style={[
            Type.metricSmall,
            styles.counter,
            over > 0 && styles.counterOver,
          ]}
        >
          {over > 0
            ? t("online.chat.tooLong", { count: over })
            : t("online.chat.remaining", { count: -over })}
        </Text>
      ) : null}

      <View style={[styles.inputShell, over > 0 && styles.inputShellOver]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={t("online.chat.placeholder")}
          placeholderTextColor={colors.text.faint}
          style={[Type.body, styles.input]}
          multiline
          // Sin tope duro: pasarse tiene que poder verse y corregirse. Lo que
          // frena el envío es el botón, no el campo.
          maxLength={MESSAGE_MAX_LENGTH * 2}
          accessibilityLabel={t("online.chat.placeholder")}
        />

        <IconButton
          name="send"
          onPress={onSubmit}
          disabled={!canSend}
          accessibilityLabel={t("online.chat.send")}
          size={18}
          color={
            canSend
              ? colors.spectrum[SECTION_TONE.groups].ink
              : colors.text.faint
          }
          style={[styles.sendButton, canSend && styles.sendButtonReady]}
        />
      </View>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  shell: {
    // La conversación tiene que poder ocupar todo el alto disponible, y el
    // relleno inferior de una pantalla normal lo pone aquí el campo de
    // escritura, que además tiene que llegar al borde.
    flex: 1,
    paddingBottom: 0,
  },
  fill: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
  },

  // -- Cabecera -------------------------------------------------------------
  head: {
    marginBottom: Space.lg,
  },
  eyebrow: {
    marginBottom: Space.xs,
    color: c.accent.text,
  },
  headHint: {
    marginTop: Space.xxs,
  },

  // -- Sondeo caído ---------------------------------------------------------
  stale: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    marginBottom: Space.sm,
    borderRadius: Radius.md,
    backgroundColor: c.surface.sunken,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  staleText: {
    flex: 1,
  },

  // -- La lista -------------------------------------------------------------
  listContent: {
    paddingTop: Space.md,
    paddingBottom: Space.md,
    gap: Space.xs,
  },
  daySeparator: {
    alignItems: "center",
    paddingVertical: Space.md,
  },
  older: {
    paddingVertical: Space.lg,
  },

  // -- Burbujas -------------------------------------------------------------
  line: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Space.sm,
  },
  lineMine: {
    justifyContent: "flex-end",
  },
  lineTheirs: {
    justifyContent: "flex-start",
  },
  avatarGap: {
    width: 28,
  },
  stack: {
    // Una burbuja nunca cruza la pantalla de lado a lado: sin este tope, un
    // mensaje largo del otro deja de parecer de nadie en concreto.
    maxWidth: "78%",
  },
  stackMine: {
    alignItems: "flex-end",
  },
  stackTheirs: {
    alignItems: "flex-start",
  },
  bubble: {
    paddingVertical: Space.sm + 2,
    paddingHorizontal: Space.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  /** El pico de quien habla: la esquina viva, del lado de su autor. */
  tailTheirs: {
    borderBottomLeftRadius: Radius.sm / 2,
  },
  tailMine: {
    borderBottomRightRadius: Radius.sm / 2,
  },
  bubblePending: {
    opacity: DISABLED_OPACITY + 0.35,
  },
  bubbleFailed: {
    borderColor: c.danger.border,
  },
  author: {
    marginBottom: Space.xxs,
  },
  body: {
    // El cuerpo de un mensaje es el contenido principal de la pantalla, no un
    // texto de apoyo: va en el claro de los títulos, no en el gris del cuerpo.
    color: c.text.primary,
  },
  time: {
    marginTop: Space.xxs,
    marginHorizontal: Space.xs,
    color: c.text.faint,
  },
  failedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.xxs,
    marginHorizontal: Space.xs,
  },
  failedText: {
    color: c.danger.text,
  },
  failedAction: {
    color: c.accent.text,
  },
  failedDiscard: {
    color: c.text.muted,
  },

  // -- Campo de escritura ---------------------------------------------------
  composer: {
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
  },
  counter: {
    alignSelf: "flex-end",
    marginBottom: Space.xs,
    color: c.text.muted,
  },
  counterOver: {
    color: c.danger.text,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Space.sm,
    paddingLeft: Space.md,
    paddingRight: Space.xs,
    paddingVertical: Space.xs,
    borderRadius: Radius.xl,
    backgroundColor: c.surface.sunken,
    borderWidth: 1,
    borderColor: c.border.default,
  },
  inputShellOver: {
    borderColor: c.danger.border,
  },
  input: {
    flex: 1,
    color: c.text.primary,
    paddingVertical: Space.sm,
    // Cinco renglones y a partir de ahí el propio campo hace scroll: un mensaje
    // muy largo no puede comerse la conversación que se está escribiendo.
    maxHeight: 22 * 5,
  },
  sendButton: {
    borderRadius: Radius.pill,
    backgroundColor: c.surface.interactive,
  },
  sendButtonReady: {
    backgroundColor: c.spectrum[SECTION_TONE.groups].pigment,
  },
  });
