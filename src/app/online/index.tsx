import { useFocusEffect, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SettingsButton } from "@/components/SettingsButton";
import { describeError } from "@/api/errors";
import type {
  DailyGroupStatus,
  DailyOverview,
  GroupSummary,
} from "@/api/types";
import { ChallengeWall, type WallItem } from "@/components/online/ChallengeWall";
import { DevFirstRunPanel } from "@/components/online/DevFirstRunPanel";
import { useOnlineTabBarSpace } from "@/components/online/OnlineTabBar";
import { useTour, useTourAnchor } from "@/components/online/OnlineTour";
import { UnreadDot } from "@/components/online/UnreadDot";
import { StreakRibbon } from "@/components/online/StreakRibbon";
import { AmbientOrbs } from "@/design/Ambient";
import { Button } from "@/design/Button";
import { ErrorBanner, Loading } from "@/design/Feedback";
import { GlowBorder } from "@/design/Glow";
import { Divider, OptionRow, Screen, SectionHeader, TextLink } from "@/design/Layout";
import { SwatchFan } from "@/design/SwatchFan";
import { Radius, SECTION_TONE, Space, Type } from "@/design/tokens";
import { getLocale, t } from "@/i18n";
import {
  membersLabel,
  seasonLabel,
  silenceMutedGroups,
  sortGroups,
} from "@/online/groups";
import { useFirstRunMock } from "@/online/devFirstRun";
import { useSession } from "@/online/session";
import { setLanding } from "@/utils/storage";
import { readAttempt, type StoredRound } from "@/online/attempts";
import {
  markPlayed,
  readStreak,
  visibleStreak,
  type Streak,
} from "@/online/streak";

/**
 * El menú del modo online: **una sola pregunta, ¿qué juego hoy?**
 *
 * ## Qué se quitó y por qué
 *
 * La versión anterior apilaba cinco bloques —tu puntuación, tus grupos, «más»,
 * dos atajos y tu cuenta— y, según cuántos grupos tuvieras, entre once y quince
 * objetivos táctiles con el mismo peso visual. Tres de los cinco bloques eran
 * navegación pura, así que la pantalla contestaba «¿a dónde puedo ir?» a alguien
 * que la abría preguntando «¿qué juego hoy?».
 *
 * Ahora la navegación vive en la barra de pestañas, el estado se comprime a una
 * tira de una línea, y la fila de «partida online» —desactivada, con su pastilla
 * de «pronto»— desaparece: una fila que no se puede pulsar ocupa lo mismo que
 * una que sí.
 *
 * ## Por qué esta pantalla NO se parece a la ficha de un grupo
 *
 * Durante un tiempo se parecieron demasiado, y no era cosa del estilo: las dos
 * construían su héroe con **el mismo objeto** —tarjeta con borde de aurora,
 * anillo grande con el logo dentro, puntuación debajo y botón azul—. Dos
 * pantallas con el mismo protagonista se leen como la misma pantalla.
 *
 * El reparto correcto es este: la ficha de un grupo es **un grupo en
 * profundidad** —su anillo a tamaño completo, su clasificación, su temporada—, y
 * el menú es **tu día entero**. Son preguntas distintas y ahora tienen formas
 * distintas.
 *
 * Aquí el anillo sigue estando, pero deja de mandar: hay uno **por grupo**, en
 * pequeño, dentro de su baldosa. Un anillo grande es un reto; tres pequeños son
 * un día — y verlos juntos permite comparar la jornada de un vistazo, que es lo
 * único que la app no dejaba hacer sin ir abriendo grupos de uno en uno.
 *
 * ## Las tres piezas
 *
 * La **cinta** de la racha arriba: los días como marcas, con hoy hueco hasta que
 * juegas. El **muro** debajo: una baldosa por reto vivo, teñida con el color del
 * grupo y con su dial centrado. Y la **lista**, para lo que no cabe en el muro,
 * separada en lo que aún se puede jugar y lo que hoy ya está.
 */

/**
 * Pedir el reto de cada grupo del muro para saber CUÁNTAS RONDAS tiene.
 *
 * `daily.overview()` no trae las rondas —solo intentos y puntuación—, así que
 * el número hay que sacarlo de `daily.today(grupo)`. Tiene un efecto que
 * conviene tener presente: ese endpoint **crea el reto del día** si nadie lo ha
 * abierto todavía, así que abrir el menú lo adelanta a antes de jugar. No gasta
 * intentos ni puntúa, pero es un cambio de comportamiento real.
 *
 * Se pide solo para los grupos que salen en el muro —como mucho `MAX_WALL`,
 * nunca para todos— y solo si queda algo por jugar.
 *
 * Si un día molesta, se pone a `false`: los diales se quedan con cinco arcos,
 * que es el tamaño habitual de una jornada, y todo lo demás sigue igual. Es una
 * degradación mucho más barata que antes, cuando apagarlo dejaba las tarjetas
 * sin logo.
 */
const PREFETCH_ROUNDS = true;

/**
 * Cuántos retos entran en el muro.
 *
 * Tres, y el número no es solo estético: cada baldosa cuesta **una petición** —el
 * reto— más una lectura local. Con el carrusel eran tres peticiones por tarjeta,
 * porque además pedía el marcador para la línea de «a quién adelantas»; el muro
 * no la enseña, así que abrir el menú cuesta ahora un tercio.
 *
 * Y tres es lo que cabe en el mosaico sin que las baldosas se hagan tan pequeñas
 * que el dial deje de leerse: una ancha arriba y dos a media anchura debajo. Los
 * que no caben salen escritos debajo, que es donde una lista funciona mejor que
 * una cuadrícula.
 */
const MAX_WALL = 3;

/** Cuántos grupos se listan bajo el carrusel antes de mandar a la pestaña. */
const MAX_TAIL_GROUPS = 4;

/**
 * Lo que el muro necesita saber de un grupo, además de lo que ya trae la lista.
 *
 * Es bastante menos que antes. La tarjeta del carrusel pedía **tres** cosas por
 * grupo —el reto, el marcador y el intento guardado— porque enseñaba el logo del
 * día y la línea de «a quién adelantas». La baldosa no enseña ninguna de las
 * dos: le basta con cuántas rondas hay y cómo fue tu intento, así que el
 * marcador deja de pedirse. Son tres peticiones menos por jornada.
 */
interface ChallengeDay {
  /** Cuántas rondas tiene el reto de hoy. */
  rounds: number;
  /** El desglose del intento de hoy, del almacén local. */
  solved: StoredRound[] | null;
}

export default function OnlineHubScreen(): ReactElement {
  const { api, reloadUser, user } = useSession();
  const router = useRouter();
  const tabBarSpace = useOnlineTabBarSpace();

  /**
   * El recorrido de la barra de pestañas.
   *
   * Lo arranca esta pantalla y no el layout porque la condición de «primera
   * vez» es **no tener ningún grupo**, y quien pide los grupos es esta. El
   * layout solo sabe que hay sesión, que no es lo mismo: con esa sola señal se
   * le explicaría la barra a quien lleva un año jugando.
   */
  const { start: startTour, startOnce } = useTour();
  /** Simulador de primera vez. Fuera de desarrollo siempre es `false`. */
  const firstRunMock = useFirstRunMock();

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [daily, setDaily] = useState<DailyOverview | null>(null);
  /**
   * Lo de cada reto del muro, indexado por grupo.
   *
   * Por `groupId` y no por posición: reordenar la cola no debe poder mezclar los
   * arcos de un grupo con los de otro.
   */
  const [days, setDays] = useState<Record<string, ChallengeDay>>({});
  /**
   * La racha entera, no solo el numero: el calendario de la cinta necesita
   * saber QUE dias se jugaron, y eso no cabe en un contador.
   */
  const [streak, setStreak] = useState<Streak>({
    count: 0,
    lastDate: null,
    days: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      /*
        Ya no se pide `leaderboards.me()`. El puesto global y el de amigos
        vivían en la tarjeta de puntuación de esta pantalla, y se han ido a la
        pestaña Perfil: son cifras que se miran cuando se quieren mirar, no
        cada vez que se abre la app a jugar. Con ellas se va también su
        petición, en una pantalla que se recarga en cada focus.
      */
      const [groupsResult, dailyResult] = await Promise.all([
        api.groups.list(),
        // Si falla, la pantalla se queda sin saber qué hay jugado hoy y trata
        // todos los grupos como pendientes. Es preferible a tumbar el menú.
        api.daily.overview().catch(() => null),
        reloadUser(),
      ]);

      // El punto rojo de un grupo silenciado no se pinta (ajustes del grupo).
      setGroups(silenceMutedGroups(groupsResult.groups));
      setDaily(dailyResult);

      // --- La racha ------------------------------------------------------
      // Se cuenta aquí y no en la pantalla de la partida a propósito: así el
      // reto no tiene que saber nada de rachas, y volver al menú desde
      // cualquier sitio la deja al día. `markPlayed` es idempotente.
      const playedToday =
        dailyResult?.groups.some((entry) => entry.bestScore != null) ?? false;

      const stored = playedToday
        ? await markPlayed(dailyResult!.challengeDate)
        : await readStreak();

      setStreak(stored);

      // --- Los retos que tocan --------------------------------------------
      const byGroup = new Map<string, DailyGroupStatus>(
        (dailyResult?.groups ?? []).map((entry) => [entry.groupId, entry]),
      );
      const featured = buildQueue(groupsResult.groups, byGroup).slice(0, MAX_WALL);

      if (featured.length === 0) {
        setDays({});
        return;
      }

      /*
        Los grupos del muro en paralelo, y cada uno con sus dos lecturas también
        en paralelo. Ninguna es obligatoria: si una falla, esa baldosa se pinta
        con cinco arcos vacíos en lugar de con los suyos, pero se pinta — y sobre
        todo, el fallo de un grupo no deja al resto del muro en blanco.
      */
      const loaded = await Promise.all(
        featured.map(async (group): Promise<[string, ChallengeDay]> => {
          const [todayResult, storedRounds] = await Promise.all([
            PREFETCH_ROUNDS
              ? api.daily.today(group.id).catch(() => null)
              : Promise.resolve(null),
            dailyResult
              ? readAttempt(group.id, dailyResult.challengeDate)
              : Promise.resolve(null),
          ]);

          return [
            group.id,
            {
              rounds: todayResult?.challenge.rounds.length ?? 0,
              solved: storedRounds,
            },
          ];
        }),
      );

      setDays(Object.fromEntries(loaded));
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [api, reloadUser]);

  /**
   * Cuántas veces se ha entrado en esta pantalla.
   *
   * Sirve para una sola cosa: volver a repartir el abanico de muestras del
   * estado vacío. Esta pantalla es una pestaña y no se desmonta al salir de
   * ella, así que sin esto el abanico solo se abre la primera vez y quien
   * vuelve del ranking se lo encuentra ya desplegado, sin el gesto que dice de
   * qué va el juego — que es justamente lo único que esa pantalla enseña.
   *
   * Es un contador y no un booleano porque lo que se pide es un gesto, no un
   * estado: dos entradas seguidas tienen que poder pedir lo mismo dos veces.
   */
  const [visit, setVisit] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void load();
      setVisit((count) => count + 1);
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /**
   * La pista para la portada.
   *
   * La raíz de la aplicación no puede preguntar por la sesión —no monta Clerk,
   * esa es la frontera que mantiene el modo offline sin red—, así que quien
   * sabe algo lo deja escrito y ella lo lee. Esta pantalla es el único sitio
   * donde constan a la vez la sesión, los grupos y la racha, y se recarga en
   * cada focus, con lo que la pista se mantiene fresca sola.
   *
   * Va en su propio efecto y no dentro de `load` por un motivo concreto: el
   * nombre sale de `user`, y `user` cambia de identidad cada vez que `load`
   * llama a `reloadUser`. Metido en las dependencias de `load`, el efecto de
   * focus que lo dispara se relanzaría en bucle. Como pista es estado
   * derivado, aquí se deriva.
   *
   * Sin `await`: es una escritura de mejor esfuerzo para la próxima vez que se
   * abra la aplicación, y nada de esta pantalla depende de ella.
   */
  useEffect(() => {
    if (groups == null) {
      // Todavía cargando. Escribir ahora diría «cero grupos» y apagaría la
      // rueda de la portada por un instante de red.
      return;
    }

    void setLanding({
      signedIn: true,
      groups: groups.length,
      streak: streak.count,
      streakSecured:
        daily?.groups.some((entry) => entry.bestScore != null) ?? false,
      username: user?.username ?? "",
    });
  }, [daily, groups, streak, user]);

  const dailyByGroup = new Map<string, DailyGroupStatus>(
    (daily?.groups ?? []).map((entry) => [entry.groupId, entry]),
  );

  /*
    El simulador de primera vez vacía la lista **aquí**, en lo que se pinta, y
    no en `groups`. La diferencia importa: `groups` es lo que alimenta la pista
    que se guarda para la portada, y falsearlo dejaría la rueda apagada al
    apagar el simulador. Ver `online/devFirstRun`.
  */
  const ordered = firstRunMock ? [] : groups ? sortGroups(groups) : null;

  /**
   * La primera vez, y solo entonces: sesión abierta y ningún grupo.
   *
   * Se espera a que la lista haya llegado —`null` es «todavía no lo sé», no
   * «no hay»— porque arrancar antes explicaría la barra sobre una pantalla que
   * un segundo después se llena de retos.
   *
   * `startOnce` se encarga del resto: mira la marca guardada y no vuelve a
   * preguntar en toda la sesión, así que da igual que esta pantalla se recargue
   * en cada focus.
   */
  const noGroups = ordered != null && ordered.length === 0;

  useEffect(() => {
    if (noGroups) {
      startOnce();
    }
  }, [noGroups, startOnce]);
  /** Todo lo que todavía admite un intento, con lo no jugado delante. */
  const queue = ordered ? buildQueue(ordered, dailyByGroup) : [];
  /** Los que van al carrusel: los retos vivos, como mucho `MAX_CAROUSEL`. */
  const featured = queue.slice(0, MAX_WALL);
  /**
   * Lo que se lista debajo, en dos bloques con significados distintos.
   *
   * `pending` son retos **que todavía se pueden jugar** y que no han cabido en
   * el carrusel; `resting` son grupos en los que hoy ya no hay nada que hacer
   * —o porque están jugados y sin intentos, o porque la temporada terminó—.
   * Separarlos importa: el primer bloque es tarea pendiente y el segundo es
   * archivo, y mezclarlos haría que la lista no dijera nada.
   */
  const pending = queue.slice(MAX_WALL);
  const featuredIds = new Set(queue.map((group) => group.id));
  const resting = ordered?.filter((group) => !featuredIds.has(group.id)) ?? [];
  /** Grupos con puntuación de hoy. Es lo que enciende la racha. */
  const doneCount =
    ordered?.filter((group) => isPlayed(group, dailyByGroup)).length ?? 0;
  const playedToday = doneCount > 0;

  /** Los retos que van al muro, con lo que cada baldosa necesita. */
  const wall: WallItem[] = featured.map((group) => ({
    group,
    rounds: days[group.id]?.rounds ?? 0,
    solved: days[group.id]?.solved ?? null,
    status: dailyByGroup.get(group.id),
  }));

  const todayPoints =
    daily == null
      ? null
      : daily.groups.reduce((total, entry) => total + (entry.bestScore ?? 0), 0) ||
        null;

  return (
    <Screen
      /*
        La flecha se queda AQUÍ y solo aquí, aunque esto sea la raíz de una
        pestaña. `/online` no es la raíz de la app: es una sección en la que se
        entra desde la portada, y sin esta flecha el modo online no tiene
        salida — la barra de pestañas te mueve entre sus cuatro destinos, pero
        ninguno de ellos lleva de vuelta al juego sin conexión.

        Las otras tres pestañas no la llevan: una flecha de volver en la raíz de
        una pestaña apunta a otra pestaña, y eso no es volver, es saltar.
      */
      /*
        El titular contesta la pregunta con la que se abre la app. Antes esta
        pantalla no tenía ninguno —empezaba directamente en la tira de identidad—
        y con eso el menú no decía nunca qué había que hacer hoy.
      */
      eyebrow={dayLabel(daily?.challengeDate ?? null)}
      title={
        ordered == null || ordered.length === 0
          ? undefined
          : featured.length === 0
            ? t("online.hub.dayDone")
            : t(
                featured.length === 1
                  ? "online.hub.dayLeftOne"
                  : "online.hub.dayLeft",
                { count: featured.length },
              )
      }
      backTo="/"
      backdrop={<AmbientOrbs />}
      contentStyle={{ paddingBottom: tabBarSpace }}
      headerAction={<SettingsButton />}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      {/* -------------------------- La racha ---------------------------- */}
      {/*
        Sustituye a la tira de identidad, que llevaba avatar, nombre y nivel
        además de la llama. Las tres primeras cosas ya viven en la pestaña
        Perfil y ahí es donde se van a mirar; lo único de aquella tira que
        pertenecía a esta pantalla era la racha, porque es lo único que se puede
        perder hoy.
      */}
      <StreakRibbon
        count={visibleStreak(streak, daily?.challengeDate ?? streak.lastDate ?? "")}
        lit={playedToday}
        days={streak.days}
        todayKey={daily?.challengeDate ?? null}
        onPress={() => router.push("/online/profile")}
      />

      {/* ------------------------- Los retos de hoy --------------------- */}
      {/*
        Mientras no hay grupos que enseñar solo puede pasar una de dos cosas:
        se están pidiendo, o la petición ha fallado. Antes no se decía ninguna
        —el hueco se quedaba en blanco— y el menú parecía vacío en vez de
        ocupado. Con el fallo ya habla el banner de arriba, así que aquí se
        calla para no decir dos veces lo mismo.
      */}
      {ordered == null ? (
        error ? null : <Loading label={t("online.hub.loading")} />
      ) : ordered.length === 0 ? (
        <FirstGroup
          visit={visit}
          onCreate={() =>
            router.push({
              pathname: "/online/groups",
              params: { action: "create" },
            })
          }
          onJoin={() =>
            router.push({ pathname: "/online/groups", params: { action: "join" } })
          }
        />
      ) : featured.length === 0 ? (
        /*
          Solo aqui: cuando NINGUN grupo admite ya un intento. Antes esta
          pantalla salia en cuanto se habia jugado una vez en todos, y eso era
          declarar la jornada terminada teniendo intentos en la mano.
        */
        <AllDone points={todayPoints} total={ordered.length} />
      ) : (
        <ChallengeWall
          items={wall}
          /*
            La baldosa abre el grupo; jugar se decide dentro. Ver la nota de
            `ChallengeWall`: un toque en una tarjeta debe abrirla, no disparar la
            acción más irreversible que contiene.
          */
          onOpen={(group) =>
            router.push({
              pathname: "/online/groups/[id]",
              params: { id: group.id },
            })
          }
        />
      )}

      {/* --------------------- Lo que queda, y lo hecho ------------------ */}
      {pending.length > 0 || resting.length > 0 ? (
        <>
          <SectionHeader
            title={t("online.hub.playSection")}
            hint={
              playedToday && queue.length === 0
                ? t("online.hub.playHintDone")
                : undefined
            }
          />

          <View style={styles.tail}>
            {/*
              Primero lo que todavia se puede jugar y no cupo en el carrusel,
              despues lo que ya esta hecho o cerrado. El orden es el de la
              urgencia: lo pendiente arriba.
            */}
            {pending.slice(0, MAX_TAIL_GROUPS).map((group) => (
              <OptionRow
                key={group.id}
                icon="calendar"
                tone="teal"
                title={group.name}
                description={`${membersLabel(group.memberCount)} · ${seasonLabel(group)}`}
                badge={<UnreadDot count={group.unreadCount} />}
                accessibilityLabel={
                  group.unreadCount > 0
                    ? `${group.name}. ${t("online.groups.unread")}`
                    : group.name
                }
                onPress={() =>
                  router.push({
                    pathname: "/online/groups/[id]",
                    params: { id: group.id },
                  })
                }
              />
            ))}

            {resting.slice(0, MAX_TAIL_GROUPS).map((group) => {
              const status = dailyByGroup.get(group.id);
              const over = group.status === "finished";

              return (
                <OptionRow
                  key={group.id}
                  icon={over ? "hourglass" : "check"}
                  tone={over ? "rose" : "green"}
                  title={group.name}
                  description={`${membersLabel(group.memberCount)} · ${seasonLabel(group)}`}
                  note={
                    status?.bestScore != null
                      ? t("online.hub.group.played", { score: status.bestScore })
                      : undefined
                  }
                  badge={<UnreadDot count={group.unreadCount} />}
                  accessibilityLabel={
                    group.unreadCount > 0
                      ? `${group.name}. ${t("online.groups.unread")}`
                      : group.name
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/online/groups/[id]",
                      params: { id: group.id },
                    })
                  }
                />
              );
            })}
          </View>
        </>
      ) : null}

      {/*
        La salida a la pestana Grupos, siempre que haya alguno. Va fuera del
        bloque de arriba a proposito: con un solo grupo no hay lista que
        ensenar, pero seguir teniendo a mano «todos mis grupos» es justo lo que
        evita que el carrusel se sienta como una jaula.
      */}
      {ordered != null && ordered.length > 0 ? (
        <TextLink
          label={t("online.hub.seeAllGroups")}
          onPress={() => router.push("/online/groups")}
        />
      ) : null}

      {/*
        La puerta de vuelta al recorrido de la barra.

        Existe por lo mismo que el atajo de la bienvenida: un tutorial que solo
        se enseña una vez y no se puede repetir acaba pidiéndose por soporte. Y
        va **aquí abajo y como enlace**, no como tarjeta ni como botón: quien lo
        necesita lo busca, y quien no, no debería tropezarse cada día con una
        oferta de explicarle una barra que ya sabe usar.

        La raya de arriba es lo que lo separa del contenido: sin ella, un enlace
        suelto tras la lista se lee como una fila más de la lista.
      */}
      <Divider />

      <TextLink label={t("online.hub.tour")} onPress={startTour} />

      {/* Simulador de primera vez. Devuelve `null` fuera de `__DEV__`. */}
      <DevFirstRunPanel />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sin grupos todavía
// ---------------------------------------------------------------------------

/**
 * La invitación a crear el primer grupo.
 *
 * ## Qué reemplaza
 *
 * Un icono apagado dentro de un cuadro gris, con dos botones debajo. El
 * problema no era que fuese sosa: era que **es la primera pantalla del modo
 * online** para alguien que acaba de registrarse, y no enseñaba nada de a qué
 * se juega. Pedía crear un grupo sin decir para qué sirve tener uno.
 *
 * ## Qué hace ahora
 *
 * Enseña el juego antes de pedir nada: el abanico de muestras dice «esto va de
 * color» sin una sola palabra, y el texto de debajo dice qué pasa dentro de un
 * grupo —un logo al día, y compites con quien invites—, que es la información
 * que falta para querer crear uno.
 *
 * ## El borde de aurora
 *
 * La regla del borde es **uno por pantalla**, el que hay que mirar. Aquí no
 * compite con nada: sin grupos no hay tarjeta de reto, así que esta es la única
 * cosa de la pantalla, y es literalmente lo único que se puede hacer. Cuando
 * aparece el primer grupo, este bloque desaparece y el borde vuelve a su sitio
 * de siempre, la tarjeta del reto de hoy.
 */
function FirstGroup({
  visit,
  onCreate,
  onJoin,
}: {
  /** Sube cada vez que se entra en la pantalla; reparte el abanico otra vez. */
  visit: number;
  onCreate: () => void;
  onJoin: () => void;
}): ReactElement {
  /*
    El último paso del recorrido de la primera vez señala este botón, que es lo
    único que se puede hacer sin grupos. Va sobre un envoltorio y no sobre el
    botón porque `Button` está memoizado y no reenvía `ref`: darle esa capacidad
    por una necesidad de esta pantalla sería tocar el componente que usa media
    aplicación. Un `View` sin estilo no mueve la maquetación —el margen sigue
    siendo del botón—, así que se queda aquí.
  */
  const createAnchor = useTourAnchor("firstGroup");

  return (
    <GlowBorder
      radius={Radius.xl}
      padding={Space.xxl}
      style={styles.firstGroup}
    >
      <SwatchFan replay={visit} />

      <Text style={[Type.title, styles.firstGroupTitle]}>
        {t("online.hub.groupsEmpty")}
      </Text>
      <Text style={[Type.body, styles.firstGroupHint]}>
        {t("online.hub.groupsEmptyHint")}
      </Text>

      <View ref={createAnchor} collapsable={false}>
        <Button
          label={t("online.hub.quickCreate")}
          icon="plus"
          // Teal: es una acción de la sección «grupos», y ese es su pigmento en
          // toda la aplicación — empezando por su pestaña.
          tone={SECTION_TONE.groups}
          onPress={onCreate}
          style={styles.emptyAction}
        />
      </View>

      <Button
        label={t("online.hub.quickJoin")}
        icon="users"
        variant="secondary"
        onPress={onJoin}
        style={styles.emptySecondary}
      />
    </GlowBorder>
  );
}

// ---------------------------------------------------------------------------
// Cola
// ---------------------------------------------------------------------------

/**
 * ¿El servidor admite otro intento en este grupo?
 *
 * Es lo único que decide si un grupo sigue en la cola. Con la temporada
 * terminada no hay nada que jugar, y sin intentos tampoco.
 *
 * **Ojo, no es lo mismo que «sin jugar hoy».** Un grupo jugado una vez conserva
 * su segundo intento, así que sigue en la cola: la pantalla no puede declarar
 * la jornada terminada mientras quede algo que se pueda jugar. Lo que cambia no
 * es si aparece, sino cómo — con la rueda ya pintada y ofreciendo el segundo
 * intento en vez de la pregunta.
 */
function hasAttempts(
  group: GroupSummary,
  byGroup: Map<string, DailyGroupStatus>,
): boolean {
  if (group.status === "finished") {
    return false;
  }
  const status = byGroup.get(group.id);
  // Sin datos del reto se asume que sí: es mejor ofrecer jugar y que la
  // pantalla del reto lo desmienta, que esconder un reto que sí estaba.
  return status == null || status.attemptsLeft > 0;
}

/** ¿Ya hay una puntuación de hoy en este grupo? */
function isPlayed(
  group: GroupSummary,
  byGroup: Map<string, DailyGroupStatus>,
): boolean {
  return byGroup.get(group.id)?.bestScore != null;
}

/**
 * La cola del día: todo lo que todavía admite un intento.
 *
 * El orden es el de `sortGroups` —temporada que antes acaba primero— con una
 * capa encima: **lo que no se ha tocado hoy va delante**. Así, con tres grupos
 * y uno ya jugado, el menú ofrece los dos vírgenes antes de proponerte repetir;
 * y cuando ya no queda ninguno virgen, sigue habiendo qué hacer en vez de una
 * pantalla que dice que has terminado teniendo intentos en la mano.
 */
function buildQueue(
  groups: GroupSummary[],
  byGroup: Map<string, DailyGroupStatus>,
): GroupSummary[] {
  return sortGroups(groups)
    .filter((group) => hasAttempts(group, byGroup))
    .sort(
      (a, b) =>
        Number(isPlayed(a, byGroup)) - Number(isPlayed(b, byGroup)),
    );
}

/**
 * La jornada, escrita: «martes 2 de septiembre».
 *
 * Se formatea desde la fecha del RETO y no desde el reloj del teléfono. Con el
 * viaje en el tiempo del backend los dos discrepan, y el kicker acabaría diciendo
 * un día distinto del que se está jugando.
 *
 * `T12:00:00` no es decorativo: `new Date("2026-09-02")` se interpreta como
 * medianoche UTC, así que en cualquier huso al oeste de Greenwich la fecha
 * formateada saldría el día anterior. Al mediodía no hay huso que la mueva.
 */
function dayLabel(challengeDate: string | null): string {
  const date =
    challengeDate != null ? new Date(`${challengeDate}T12:00:00`) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(getLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ---------------------------------------------------------------------------
// Cola blanda y estado final
// ---------------------------------------------------------------------------

/** Nada que jugar: la pantalla deja de pedir cosas. */
function AllDone({
  points,
  total,
}: {
  points: number | null;
  total: number;
}): ReactElement {
  return (
    <GlowBorder radius={Radius.xl} padding={Space.xxl} still style={styles.block}>
      <View style={styles.doneBody}>
        <Text style={Type.label}>
          {t("online.hub.queueDone", { total })}
        </Text>
        <Text style={[Type.metricHero, styles.doneScore]}>
          {points != null ? String(points) : t("online.hub.unranked")}
        </Text>
        <Text style={Type.caption}>{t("online.hub.todayPoints")}</Text>
        <Text style={[Type.body, styles.doneHint]}>
          {t("online.hub.allDoneHint")}
        </Text>
      </View>
    </GlowBorder>
  );
}

const styles = StyleSheet.create({
  doneBody: {
    alignItems: "center",
    gap: Space.xs,
  },
  doneScore: {
    marginTop: Space.sm,
  },
  doneHint: {
    textAlign: "center",
    marginTop: Space.md,
  },
  block: {
    marginBottom: Space.xl,
  },
  firstGroup: {
    marginBottom: Space.xl,
  },
  firstGroupTitle: {
    textAlign: "center",
    marginTop: Space.xl,
  },
  firstGroupHint: {
    textAlign: "center",
    marginTop: Space.sm,
    // El texto no debe cruzar la tarjeta de lado a lado en una tablet: dos
    // líneas cortas y centradas se leen de un vistazo, una larga no.
    alignSelf: "center",
    maxWidth: 320,
  },
  emptyAction: {
    marginTop: Space.xxl,
  },
  emptySecondary: {
    marginTop: Space.sm,
  },
  tail: {
    gap: Space.md,
  },
});
