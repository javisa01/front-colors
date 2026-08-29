import { getLocales } from "expo-localization";

/**
 * Lightweight i18n layer.
 *
 * The app ships Spanish, English and French. Spanish (`es`) is the source of
 * truth and the fallback; `en` and `fr` mirror the same keys. Every user-facing
 * string goes through `t()`, so adding another language is just a matter of
 * dropping another dictionary into `resources` below. Interpolation uses a
 * simple `{{name}}` syntax.
 *
 * NOTE: `expo-localization` is used only to detect the device language. If it
 * is not installed yet run `npx expo install expo-localization`; the code falls
 * back to Spanish if detection fails.
 */

type Params = Record<string, string | number>;

const es = {
  "common.back": "Inicio",
  "common.backShort": "Atrás",
  "common.exit": "Salir",
  "common.next": "Siguiente",
  "common.retry": "Reintentar",
  "common.share": "Compartir",
  "common.loading": "Cargando juego...",
  "common.continue": "Continuar",

  // Etiquetas que solo lee un lector de pantalla: iconos sueltos y controles
  // cuyo texto visible no describe la acción.
  "a11y.back": "Volver",
  "a11y.close": "Cerrar",
  "a11y.stars": "{{value}} de {{total}} estrellas",
  "a11y.rank": "Puesto {{position}}",
  "a11y.playersDecrease": "Quitar un jugador",
  "a11y.playersIncrease": "Añadir un jugador",
  "a11y.wheel": "Rueda de tono y saturación",
  "a11y.brightness": "Brillo",
  "a11y.selectedColor": "Color seleccionado",

  "landing.badge": "Color Quest",
  "landing.title": "Elige cómo\nquieres jugar",
  "landing.subtitle":
    "Practica en solitario o reúne a tus amigos alrededor de un mismo móvil.",
  "landing.online.title": "Online",
  "landing.online.description":
    "Compite contra otros jugadores en tiempo real.",
  "landing.online.locked": "Necesita conexión a internet",
  "landing.offline.title": "Offline",
  "landing.offline.description":
    "Modo práctica y partidas en grupo en este dispositivo.",
  "landing.soon": "Pronto",
  "landing.footer": "Offline funciona sin conexión; online necesita cuenta.",

  "offline.badge": "Modo offline",
  "offline.title": "Práctica y grupo",
  "offline.subtitle": "Juega tú solo o pásate el móvil entre varias personas.",
  "offline.solo.section": "Solitario",
  "offline.solo.hint": "Modos de práctica para un jugador.",
  "offline.group.section": "En grupo · mismo móvil",
  "offline.group.hint": "Hasta 99 jugadores por turnos.",

  "party.mode.battle.title": "Batalla de adivinar",
  "party.mode.battle.description":
    "5 imágenes por turnos. Gana quien más se acerque.",
  "party.mode.battle-timed.title": "Batalla contrarreloj",
  "party.mode.battle-timed.description":
    "20 segundos por jugador para sumar los máximos aciertos.",
  "party.mode.coop.title": "Colaborativo",
  "party.mode.coop.description":
    "Sumad vuestras puntuaciones para una nota común.",
  "party.mode.coop-timed.title": "Colaborativo contrarreloj",
  "party.mode.coop-timed.description":
    "20-30 s por jugador según cuántos seáis; sumad todo en equipo.",

  "party.setup.title": "Configura la partida",
  "party.setup.playersLabel": "Número de jugadores",
  "party.setup.playersHint": "Entre {{min}} y {{max}} jugadores.",
  "party.setup.namesLabel": "Nombres (opcional)",
  "party.setup.namesHint": "Déjalo en blanco para usar «Jugador N».",
  "party.setup.battleInfo": "{{count}} imágenes iguales para todos.",
  "party.setup.coopInfo": "{{count}} imágenes por jugador.",
  "party.setup.timedInfo": "{{seconds}} s por jugador.",
  "party.setup.start": "Empezar partida",

  "party.playerN": "Jugador {{n}}",

  "party.handoff.title": "Turno de {{name}}",
  "party.handoff.subtitle": "Pasa el móvil a este jugador.",
  "party.handoff.image": "Imagen {{current}} de {{total}}",
  "party.handoff.timed": "Tienes {{seconds}} segundos.",
  "party.handoff.start": "Estoy listo",

  "party.play.image": "Imagen {{current}} de {{total}}",
  "party.play.solved": "Aciertos: {{count}}",
  "party.play.check": "Comprobar",

  "party.guess.title": "¡Guardado!",
  "party.guess.hidden": "Pasa el móvil sin mirar el color correcto.",

  "party.round.title": "Resultado de la imagen",
  "party.round.correct": "Color correcto",
  "party.round.you": "{{name}}",

  "party.final.title": "Clasificación final",
  "party.final.coopTitle": "Resultado del equipo",
  "party.final.winner": "Gana {{name}}",
  "party.final.tie": "¡Empate!",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} aciertos",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Media del equipo: {{average}}%",
  "party.final.teamRecord": "Mejor media del equipo: {{average}}%",
  "party.final.teamRecordNew": "¡Nuevo récord del equipo!",
  "party.final.contributions": "Aportaciones",
  "party.final.replay": "Jugar otra vez",
  "party.final.home": "Volver a modos",

  "home.badge": "Color Quest",
  "home.title": "Pon a prueba\ntu ojo para el color",
  "home.subtitle":
    "Elige un modo de juego y demuestra cuánto te acercas al color perfecto.",
  "home.footer": "Más modos de juego en camino.",
  "home.soon": "Pronto",
  "home.best": "Récord: {{score}}",
  "home.bestAverage": "Récord: {{average}}%",

  "mode.quick.title": "Juego rápido",
  "mode.quick.description":
    "Adivina el color de cada reto y supera todos los niveles.",
  "mode.timed.title": "Contrarreloj",
  "mode.timed.description":
    "Acierta el máximo de colores antes de que acabe el tiempo.",
  "mode.daily.title": "Reto diario",
  "mode.daily.description":
    "Un color nuevo cada día para poner a prueba tu ojo.",
  "mode.multicolor.title": "Multicolor",
  "mode.multicolor.description":
    "Reconstruye todos los colores de un mismo logo, uno a uno.",

  "game.kicker": "Color Quest",
  "game.title": "Adivina el color",
  "game.subtitle":
    "Ajusta el selector hasta que el resultado se vea igual que el reto.",
  "game.check": "Comprobar",
  "game.empty.title": "No hay retos disponibles.",
  "game.empty.subtitle":
    "Revisa el catálogo generado o los metadatos de los retos.",
  "game.colorStep": "Color {{current}} de {{total}}",
  "game.runLabel": "Partida",
  "game.hits": "Aciertos: {{count}}",
  "game.points": "{{score}} pts",

  "progress.label": "Progreso",
  "progress.counter": "Reto {{current}} de {{total}}",

  "timer.label": "Tiempo",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Racha",
  "streak.value": "{{count}}",

  "result.kicker": "Resultado",
  "result.yours": "Tu color",
  "result.target": "Correcto",
  "result.deltaTitle": "Diferencia",
  "result.hue": "Tono",
  "result.saturation": "Saturación",
  "result.value": "Brillo",

  "summary.title": "Juego completado",
  "summary.subtitle": "Has superado todos los retos disponibles.",
  "summary.total": "Puntuación total",
  "summary.average": "Media",
  "summary.record": "¡Nuevo récord!",
  "summary.best": "Mejor: {{score}}",
  "summary.bestStreak": "Mejor racha: {{count}}",
  "summary.points": "Puntos",
  "summary.hits": "Aciertos",
  "summary.hitsOf": "de {{rounds}} intentos",
  "summary.home": "Volver al inicio",
  "summary.shareText":
    "🎨 Color Quest — {{mode}}\nPuntuación: {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Color Quest — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} aciertos ({{average}}%)\n{{stars}}",

  "daily.done.title": "Reto diario completado",
  "daily.done.subtitle": "Vuelve mañana para un color nuevo.",
  "daily.score": "Tu resultado de hoy: {{score}}%",


  "score.perfect": "¡Perfecto!",
  "score.close": "¡Muy cerca!",
  "score.good": "Buen intento",
  "score.tryAgain": "Sigue probando",

  "run.artist": "¡Ojo de artista!",
  "run.great": "¡Gran puntería!",
  "run.good": "Buen trabajo",
  "run.practice": "Sigue practicando",

  "validate.correct": "¡Correcto!",
  "validate.tryAgain": "Sigue probando.",

  "settings.title": "Ajustes de sonido",
  "settings.music": "Música",
  "settings.sfx": "Efectos",
  "settings.close": "Cerrar",

  // --- Modo online -------------------------------------------------------
  "online.session.restoring": "Recuperando tu sesión...",
  "online.level": "Nivel {{level}}",
  "online.xp": "{{xp}} XP",
  "online.xpToNext": "Faltan {{xp}} XP",

  "online.auth.badge": "Modo online",
  "online.auth.title": "Entra en tu cuenta",
  "online.auth.titleRegister": "Crea tu cuenta",
  "online.auth.subtitle":
    "Necesitas una cuenta para competir, tener amigos y aparecer en la clasificación.",
  "online.auth.subtitleRegister":
    "Elige un nombre, guarda tu progreso y compite con el resto de jugadores.",
  "online.auth.login": "Iniciar sesión",
  "online.auth.register": "Registrarse",
  "online.auth.username": "Nombre de jugador",
  "online.auth.usernamePlaceholder": "colorista",
  "online.auth.usernameHint":
    "De 3 a 24 caracteres: letras, números y . _ - Podrás cambiarlo luego.",
  "online.auth.email": "Email",
  "online.auth.emailPlaceholder": "tu@email.com",
  "online.auth.emailHint": "El email con el que creaste la cuenta.",
  "online.auth.password": "Contraseña",
  "online.auth.passwordPlaceholder": "••••••••",
  "online.auth.passwordHint": "Mínimo 8 caracteres.",
  "online.auth.switchToRegister": "¿Aún no tienes cuenta?",
  "online.auth.switchToLogin": "¿Ya tienes cuenta?",
  "online.auth.offlineNote":
    "El modo offline sigue funcionando sin cuenta ni conexión: tus récords locales no se tocan.",
  "online.auth.error.passwordRequired": "Escribe tu contraseña.",
  "online.auth.error.passwordShort": "Mínimo {{min}} caracteres.",
  "online.auth.error.usernameLength": "Entre 3 y 24 caracteres.",
  "online.auth.error.usernameChars": "Solo letras, números y . _ -",
  "online.auth.error.email": "Ese email no parece válido.",
  "online.auth.error.code": "El código tiene {{length}} dígitos.",
  "online.auth.or": "o",
  "online.auth.google": "Continuar con Google",
  "online.auth.apple": "Continuar con Apple",
  "online.auth.connecting": "Conectando...",
  "online.auth.unavailable":
    "El modo online no está configurado en esta versión de la app. El resto del juego funciona igual.",
  "online.auth.verify.title": "Confirma tu email",
  "online.auth.verify.subtitle":
    "Te hemos enviado un código de 6 dígitos a {{email}}.",
  "online.auth.verify.code": "Código de verificación",
  "online.auth.verify.codePlaceholder": "123456",
  "online.auth.verify.hint": "Mira también en la carpeta de spam.",
  "online.auth.verify.submit": "Confirmar",
  "online.auth.verify.resend": "Enviar otro código",
  "online.auth.verify.resent": "Código reenviado.",
  "online.auth.verify.back": "Cambiar de email",

  "online.hub.badge": "Modo online",
  "online.hub.title": "¿Cómo quieres\njugar?",
  "online.hub.subtitle":
    "Compite con tus amigos en un grupo privado, o mira cómo vas.",
  "online.hub.globalRank": "Puesto global",
  "online.hub.friendsRank": "Entre amigos",
  "online.hub.ofPlayers": "de {{total}} jugadores",
  "online.hub.friendCount": "{{count}} amigos",
  "online.hub.profile.title": "Perfil",
  "online.hub.profile.description": "Tu nivel, tu XP y los datos de la cuenta.",
  "online.hub.friends.title": "Amigos",
  "online.hub.friends.description": "Busca jugadores y gestiona tus solicitudes.",
  "online.hub.leaderboard.title": "Clasificación",
  "online.hub.leaderboard.description": "El ranking mundial y el de tus amigos.",
  "online.hub.match.title": "Partida online",
  "online.hub.match.description": "Compite en tiempo real contra otros jugadores.",
  "online.hub.match.locked": "Necesita partidas en tiempo real · en desarrollo",

  "online.hub.playSection": "Jugar",
  "online.hub.playHint": "El reto de hoy se juega con grupo o sin él.",
  "online.hub.playHintPending":
    "Cada grupo tiene su propio reto de hoy. Te quedan por jugar.",
  "online.hub.playHintDone": "Ya has jugado el reto de hoy en todos tus grupos.",
  "online.hub.group.play": "Jugar el reto",
  "online.hub.group.played": "Reto de hoy jugado · mejor {{score}}",
  "online.hub.todayPoints": "Puntos de hoy",
  "online.hub.todayPointsHint": "Sumando todos tus grupos",
  "online.hub.accountSection": "Tu cuenta",
  "online.hub.accountHint": "Perfil, amigos y clasificación mundial.",

  "online.hub.quickCreate": "Crear grupo",
  "online.hub.quickJoin": "Tengo un código",
  "online.hub.seeAllGroups": "Ver todos mis grupos",
  "online.hub.groupsEmpty": "Todavía no estás en ningún grupo",
  "online.hub.groupsEmptyHint":
    "Crea uno e invita con su código, o entra en el de alguien.",
  "online.hub.moreSection": "Más",
  "online.hub.scoreSection": "Tu puntuación",
  "online.hub.levelProgress": "{{current}} / {{total}} XP para el nivel {{next}}",
  "online.hub.unranked": "—",

  "online.groups.badge": "Grupos",
  "online.groups.title": "Tus grupos",
  "online.groups.subtitle":
    "Cada grupo compite 10 días. Al terminar, solo su creador puede reiniciarlo.",
  "online.groups.loading": "Cargando tus grupos...",
  "online.groups.emptyTitle": "Todavía no estás en ningún grupo",
  "online.groups.emptyHint":
    "Crea uno e invita a tus amigos con el código, o entra con el que te hayan pasado.",
  "online.groups.tabCreate": "Crear",
  "online.groups.tabJoin": "Unirme",
  "online.groups.nameLabel": "Nombre del grupo",
  "online.groups.namePlaceholder": "Los Pinceles",
  "online.groups.nameHint": "Entre 2 y 40 caracteres. Lo verán los demás.",
  "online.groups.createSubmit": "Crear grupo",
  "online.groups.codeLabel": "Código de invitación",
  "online.groups.codePlaceholder": "K7QMBN",
  "online.groups.codeHint": "6 caracteres. Da igual mayúsculas o minúsculas.",
  "online.groups.joinSubmit": "Entrar en el grupo",
  "online.groups.created": "Grupo creado. Comparte el código para invitar.",
  "online.groups.joined": "Ya estás dentro.",
  "online.groups.mine": "Mis grupos",
  "online.groups.members": "{{count}} miembros",
  "online.groups.membersOne": "1 miembro",
  "online.groups.statusActive": "Activo",
  "online.groups.statusFinished": "Terminado",
  "online.groups.daysLeft": "Quedan {{days}} días",
  "online.groups.lastDay": "Último día",
  "online.groups.endsSoon": "Termina hoy",
  "online.groups.finishedHint": "Temporada {{season}} terminada",
  "online.groups.unread": "Novedades",

  "online.group.loading": "Cargando el grupo...",
  "online.group.badge": "Grupo",
  "online.group.season": "Temporada {{season}}",
  "online.group.codeTitle": "Código de invitación",
  "online.group.codeHint": "Quien lo tenga puede entrar en el grupo.",
  "online.group.share": "Compartir",
  "online.group.shareMessage":
    "Entra en mi grupo «{{name}}» de Color Quest con el código {{code}}",
  "online.group.finishedTitle": "Esta temporada ha terminado",
  "online.group.finishedOwner":
    "La clasificación queda congelada. Puedes reiniciarla cuando quieras: los puntos vuelven a cero, pero tu XP y tu nivel no se tocan.",
  "online.group.finishedMember":
    "La clasificación queda congelada. Solo {{owner}}, que creó el grupo, puede empezar una temporada nueva.",
  "online.group.chatStillOpen": "El chat sigue abierto.",
  "online.group.renew": "Empezar temporada {{season}}",
  "online.group.renewing": "Empezando...",
  "online.group.renewed": "Temporada {{season}} en marcha.",
  "online.group.leaderboard": "Clasificación",
  "online.group.leaderboardFrozen": "Resultado final",
  "online.group.leaderboardHint": "Acumulado de la temporada.",
  "online.group.leaderboardEmpty": "Todavía no ha jugado nadie",
  "online.group.leaderboardEmptyHint":
    "Las puntuaciones del reto diario aparecen aquí en cuanto alguien juegue.",
  "online.group.points": "{{points}} pts",
  "online.group.daysPlayed": "{{days}} jornadas",
  "online.group.dayPlayed": "1 jornada",
  "online.group.notPlayed": "Sin jugar",
  "online.group.you": "Tú",
  "online.group.owner": "Creador",
  "online.group.members": "Miembros",
  "online.group.daily.title": "Reto de hoy",
  "online.group.daily.attemptsLeft": "Te quedan {{count}} intentos",
  "online.group.daily.attemptsOne": "Te queda 1 intento",
  "online.group.daily.noAttempts": "Ya has usado tus dos intentos",
  "online.group.daily.best": "Tu mejor puntuación: {{score}}",
  "online.group.daily.play": "Jugar",
  "online.group.daily.notCounting":
    "Puedes jugar el reto, pero no sumará en esta clasificación hasta que empiece una temporada nueva.",
  "online.group.chat.title": "Chat del grupo",
  "online.group.chat.description": "Píquense mientras dure la temporada.",
  "online.group.chat.soon": "En desarrollo",
  "online.group.leave": "Salir del grupo",
  "online.group.leaveOwnerHint":
    "Si te vas, el grupo pasa al miembro más antiguo.",
  "online.group.left": "Has salido del grupo.",

  "online.daily.badge": "Reto diario",
  "online.daily.title": "El reto de hoy",
  "online.daily.loading": "Cargando el reto de hoy...",
  "online.daily.roundsTitle": "{{count}} imágenes",
  "online.daily.roundsTitleOne": "1 imagen",
  "online.daily.roundsHint":
    "Las mismas para todo el mundo. Cambian cada día a las 15:00.",
  "online.daily.statusOpen": "Abierto",
  "online.daily.statusUsed": "Sin intentos",
  "online.daily.statusClosed": "Cerrado",
  "online.daily.attemptsLabel": "Intentos",
  "online.daily.attemptsHint": "{{used}} usados de 2",
  "online.daily.bestLabel": "Tu mejor",
  "online.daily.bestHint": "Puntos de hoy",
  "online.daily.closesIn": "Se cierra en",
  "online.daily.nextChallengeIn": "Próximo reto en",
  "online.daily.cutHint": "El reto cambia cada día a las 15:00, hora de Madrid.",
  "online.daily.countdownDays": "{{days}} d {{hours}} h",
  "online.daily.countdownHours": "{{hours}} h {{minutes}} min",
  "online.daily.countdownMinutes": "{{minutes}} min {{seconds}} s",
  "online.daily.countdownSeconds": "{{seconds}} s",
  "online.daily.closedTitle": "El reto ha cerrado",
  "online.daily.closedHint":
    "Ha empezado una jornada nueva. Recarga para ver los logos de hoy.",
  "online.daily.reload": "Recargar",
  "online.daily.noAttemptsTitle": "Ya has jugado hoy",
  "online.daily.noAttemptsHint":
    "Son dos intentos por jornada. Vuelve cuando abra el reto siguiente.",
  "online.daily.noActiveGroups": "No cuenta en ninguna clasificación",
  "online.daily.countsOne": "Cuenta en 1 clasificación",
  "online.daily.countsMany": "Cuenta en {{count}} clasificaciones",
  "online.daily.noGroupTitle": "Este reto es de un grupo",
  "online.daily.noGroupHint":
    "Cada grupo tiene su propio reto diario, con otras imágenes. Entra en uno para jugar.",
  "online.daily.countsIn": "Cuenta en {{group}}",
  "online.daily.countsInHint":
    "La puntuación de hoy suma solo en la clasificación de este grupo.",
  "online.daily.goToGroup": "Ver la clasificación",
  "online.daily.goToGroups": "Ver mis grupos",
  "online.daily.play": "Jugar el reto",
  "online.daily.playSecond": "Segundo intento",
  "online.daily.check": "Comprobar",
  "online.daily.finish": "Enviar intento",
  "online.daily.submitting": "Enviando tu intento...",
  "online.daily.submitFailed": "No se ha podido enviar el intento",
  "online.daily.submitRetry": "Reintentar el envío",
  "online.daily.attemptLabel": "Intento",
  "online.daily.attemptValue": "{{number}} de 2",
  "online.daily.resultTitle": "Resultado del intento",
  "online.daily.attemptPoints": "Puntos",
  "online.daily.position": "Puesto",
  "online.daily.positionHint": "En el reto de hoy",
  "online.daily.bestIsThis": "Es este intento",
  "online.daily.xpEarned": "+{{xp}} XP",
  "online.daily.xpAlready": "El XP de hoy ya estaba concedido",
  "online.daily.attemptsOneLeft": "Te queda 1 intento",
  "online.daily.finishAttempt": "Terminar",
  "online.daily.roundPoints": "{{points}} pts",
  "online.daily.roundDetail": "Ver el detalle de la ronda {{round}}",
  "online.daily.roundImage": "Imagen {{round}}",
  "online.daily.missingAsset": "Logo no disponible",
  "online.daily.rulesTitle": "Cómo funciona",
  "online.daily.ruleAttempts": "Dos intentos por jornada; cuenta el mejor.",
  "online.daily.ruleBest":
    "Tu mejor puntuación del día suma en cada grupo activo.",
  "online.daily.ruleServer":
    "El color correcto aparece al cerrar el intento: lo comprueba el servidor.",

  "online.dev.title": "Viaje en el tiempo",
  "online.dev.hint":
    "Solo en desarrollo. El desfase se pierde al reiniciar el backend.",
  "online.dev.day": "+1 día",
  "online.dev.tenDays": "+10 días",
  "online.dev.endSeason": "Terminar esta temporada",
  "online.dev.reset": "Volver al tiempo real",
  "online.dev.offset": "Desfase: {{days}} d {{hours}} h",
  "online.dev.realTime": "En tiempo real",

  "online.error.groupNotFound": "Ese grupo no existe o ya no estás en él.",
  "online.error.groupCodeInvalid": "Ese código no existe.",
  "online.error.alreadyMember": "Ya estás en ese grupo.",
  "online.error.notGroupOwner": "Solo quien creó el grupo puede hacer eso.",
  "online.error.seasonStillActive":
    "La temporada sigue en marcha: no se puede reiniciar todavía.",

  "online.profile.badge": "Perfil",
  "online.profile.title": "Tu perfil",
  "online.profile.subtitle": "Así te ven el resto de jugadores.",
  "online.profile.account": "Datos de la cuenta",
  "online.profile.memberSince": "Miembro desde",
  "online.profile.nextLevel": "Faltan {{xp}} XP para el nivel {{level}}.",
  "online.profile.edit": "Cambiar nombre",
  "online.profile.save": "Guardar",
  "online.profile.cancel": "Cancelar",
  "online.profile.saved": "Nombre actualizado.",
  "online.profile.session": "Sesión",
  "online.profile.sessionHint":
    "Al salir se borra la sesión de este dispositivo. El modo offline no se ve afectado.",
  "online.profile.logout": "Cerrar sesión",

  "online.friends.badge": "Amigos",
  "online.friends.title": "Tus amigos",
  "online.friends.subtitle": "Busca jugadores por su nombre y añádelos.",
  "online.friends.searchLabel": "Buscar jugadores",
  "online.friends.searchPlaceholder": "Nombre de usuario",
  "online.friends.searchHint": "Escribe al menos {{min}} caracteres.",
  "online.friends.searching": "Buscando...",
  "online.friends.noResults": "Nadie coincide con «{{query}}».",
  "online.friends.add": "Añadir",
  "online.friends.you": "Eres tú",
  "online.friends.alreadyFriend": "Ya sois amigos",
  "online.friends.requestSent": "Solicitud enviada",
  "online.friends.requestReceived": "Te ha escrito",
  "online.friends.incoming": "Solicitudes recibidas",
  "online.friends.incomingHint": "Acepta para veros en la clasificación de amigos.",
  "online.friends.outgoing": "Solicitudes enviadas",
  "online.friends.accept": "Aceptar",
  "online.friends.reject": "Rechazar",
  "online.friends.cancel": "Cancelar",
  "online.friends.remove": "Eliminar",
  "online.friends.list": "Amigos",
  "online.friends.listCount": "{{count}} en total.",
  "online.friends.loading": "Cargando amigos...",
  "online.friends.emptyTitle": "Todavía no tienes amigos",
  "online.friends.emptyHint":
    "Busca a alguien por su nombre de usuario y envíale una solicitud.",

  "online.leaderboard.badge": "Clasificación",
  "online.leaderboard.title": "Ranking",
  "online.leaderboard.subtitle": "Se ordena por XP acumulada.",
  "online.leaderboard.global": "Mundial",
  "online.leaderboard.friends": "Amigos",
  "online.leaderboard.total": "{{total}} jugadores",
  "online.leaderboard.you": "tú",
  "online.leaderboard.loading": "Cargando clasificación...",
  "online.leaderboard.loadMore": "Ver más",
  "online.leaderboard.loadingMore": "Cargando...",
  "online.leaderboard.emptyGlobal": "La clasificación está vacía",
  "online.leaderboard.emptyGlobalHint": "Sé el primero en sumar XP.",
  "online.leaderboard.emptyFriends": "Sin amigos en la clasificación",
  "online.leaderboard.emptyFriendsHint":
    "Añade amigos y aparecerán aquí ordenados por XP.",

  "online.error.generic": "Algo ha ido mal. Inténtalo otra vez.",
  "online.error.network":
    "No hemos podido conectar con el servidor. Revisa tu conexión.",
  "online.error.credentials": "Email o contraseña incorrectos.",
  "online.error.passwordPwned":
    "Esa contraseña ha aparecido en filtraciones conocidas. Elige otra.",
  "online.error.passwordWeak": "Esa contraseña es demasiado débil.",
  "online.error.codeIncorrect": "Ese código no es correcto.",
  "online.error.codeExpired": "El código ha caducado. Pide uno nuevo.",
  "online.error.captcha": "No hemos podido verificar que eres una persona.",
  "online.error.sessionExists": "Ya tienes la sesión abierta.",
  "online.error.emailUsed": "Ya hay una cuenta con ese email.",
  "online.error.usernameUsed": "Ese nombre de usuario ya está cogido.",
  "online.error.userNotFound": "No hemos encontrado a ese jugador.",
  "online.error.rateLimited": "Demasiados intentos. Espera un momento.",
  "online.error.validation": "Revisa los datos introducidos.",
  "online.error.sessionExpired": "Tu sesión ha caducado. Entra de nuevo.",
  "online.error.friendExists": "Ya existe una solicitud con ese jugador.",
  "online.error.friendSelf": "No puedes añadirte a ti mismo.",
  "online.error.friendNotFound": "Esa solicitud ya no existe.",
  "online.error.dailyClosed":
    "El reto que estabas jugando ha cerrado. Recarga para ver el de hoy.",
  "online.error.noAttemptsLeft": "Ya has usado tus dos intentos de hoy.",
} as const;

export type TranslationKey = keyof typeof es;

const en: Record<TranslationKey, string> = {
  "common.back": "Home",
  "common.backShort": "Back",
  "common.exit": "Exit",
  "common.next": "Next",
  "common.retry": "Retry",
  "common.share": "Share",
  "common.loading": "Loading game...",
  "common.continue": "Continue",

  "a11y.back": "Go back",
  "a11y.close": "Close",
  "a11y.stars": "{{value}} out of {{total}} stars",
  "a11y.rank": "Rank {{position}}",
  "a11y.playersDecrease": "Remove a player",
  "a11y.playersIncrease": "Add a player",
  "a11y.wheel": "Hue and saturation wheel",
  "a11y.brightness": "Brightness",
  "a11y.selectedColor": "Selected colour",

  "landing.badge": "Color Quest",
  "landing.title": "Choose how\nyou want to play",
  "landing.subtitle":
    "Practise on your own or gather your friends around a single phone.",
  "landing.online.title": "Online",
  "landing.online.description": "Compete against other players in real time.",
  "landing.online.locked": "Needs an internet connection",
  "landing.offline.title": "Offline",
  "landing.offline.description":
    "Practice mode and group matches on this device.",
  "landing.soon": "Soon",
  "landing.footer": "Offline works with no connection; online needs an account.",

  "offline.badge": "Offline mode",
  "offline.title": "Practice & group",
  "offline.subtitle": "Play solo or pass the phone around several people.",
  "offline.solo.section": "Single player",
  "offline.solo.hint": "Single-player practice modes.",
  "offline.group.section": "Group · same phone",
  "offline.group.hint": "Up to 99 players, taking turns.",

  "party.mode.battle.title": "Guessing battle",
  "party.mode.battle.description":
    "5 images in turns. Whoever gets closest wins.",
  "party.mode.battle-timed.title": "Timed battle",
  "party.mode.battle-timed.description":
    "20 seconds per player to rack up the most hits.",
  "party.mode.coop.title": "Cooperative",
  "party.mode.coop.description": "Add up your scores for a shared team result.",
  "party.mode.coop-timed.title": "Timed cooperative",
  "party.mode.coop-timed.description":
    "20-30 s per player depending on group size; add it all up as a team.",

  "party.setup.title": "Set up the match",
  "party.setup.playersLabel": "Number of players",
  "party.setup.playersHint": "Between {{min}} and {{max}} players.",
  "party.setup.namesLabel": "Names (optional)",
  "party.setup.namesHint": "Leave blank to use “Player N”.",
  "party.setup.battleInfo": "{{count}} identical images for everyone.",
  "party.setup.coopInfo": "{{count}} images per player.",
  "party.setup.timedInfo": "{{seconds}} s per player.",
  "party.setup.start": "Start match",

  "party.playerN": "Player {{n}}",

  "party.handoff.title": "{{name}}'s turn",
  "party.handoff.subtitle": "Pass the phone to this player.",
  "party.handoff.image": "Image {{current}} of {{total}}",
  "party.handoff.timed": "You have {{seconds}} seconds.",
  "party.handoff.start": "I'm ready",

  "party.play.image": "Image {{current}} of {{total}}",
  "party.play.solved": "Hits: {{count}}",
  "party.play.check": "Check",

  "party.guess.title": "Saved!",
  "party.guess.hidden": "Pass the phone without looking at the correct color.",

  "party.round.title": "Image result",
  "party.round.correct": "Correct color",
  "party.round.you": "{{name}}",

  "party.final.title": "Final ranking",
  "party.final.coopTitle": "Team result",
  "party.final.winner": "{{name}} wins",
  "party.final.tie": "It's a tie!",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} hits",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Team average: {{average}}%",
  "party.final.teamRecord": "Best team average: {{average}}%",
  "party.final.teamRecordNew": "New team record!",
  "party.final.contributions": "Contributions",
  "party.final.replay": "Play again",
  "party.final.home": "Back to modes",

  "home.badge": "Color Quest",
  "home.title": "Put your eye\nfor color to the test",
  "home.subtitle":
    "Pick a game mode and show how close you get to the perfect color.",
  "home.footer": "More game modes on the way.",
  "home.soon": "Soon",
  "home.best": "Best: {{score}}",
  "home.bestAverage": "Best: {{average}}%",

  "mode.quick.title": "Quick game",
  "mode.quick.description":
    "Guess the color of each challenge and clear every level.",
  "mode.timed.title": "Time attack",
  "mode.timed.description":
    "Hit as many colors as you can before time runs out.",
  "mode.daily.title": "Daily challenge",
  "mode.daily.description": "A new color every day to test your eye.",
  "mode.multicolor.title": "Multicolor",
  "mode.multicolor.description":
    "Rebuild every color of a single logo, one by one.",

  "game.kicker": "Color Quest",
  "game.title": "Guess the color",
  "game.subtitle":
    "Tune the picker until the result looks just like the challenge.",
  "game.check": "Check",
  "game.empty.title": "No challenges available.",
  "game.empty.subtitle":
    "Check the generated catalog or the challenge metadata.",
  "game.colorStep": "Color {{current}} of {{total}}",
  "game.runLabel": "Run",
  "game.hits": "Hits: {{count}}",
  "game.points": "{{score}} pts",

  "progress.label": "Progress",
  "progress.counter": "Challenge {{current}} of {{total}}",

  "timer.label": "Time",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Streak",
  "streak.value": "{{count}}",

  "result.kicker": "Result",
  "result.yours": "Your color",
  "result.target": "Correct",
  "result.deltaTitle": "Difference",
  "result.hue": "Hue",
  "result.saturation": "Saturation",
  "result.value": "Brightness",

  "summary.title": "Game complete",
  "summary.subtitle": "You've cleared every available challenge.",
  "summary.total": "Total score",
  "summary.average": "Average",
  "summary.record": "New record!",
  "summary.best": "Best: {{score}}",
  "summary.bestStreak": "Best streak: {{count}}",
  "summary.points": "Points",
  "summary.hits": "Hits",
  "summary.hitsOf": "of {{rounds}} guesses",
  "summary.home": "Back to home",
  "summary.shareText":
    "🎨 Color Quest — {{mode}}\nScore: {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Color Quest — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} hits ({{average}}%)\n{{stars}}",

  "daily.done.title": "Daily challenge complete",
  "daily.done.subtitle": "Come back tomorrow for a new color.",
  "daily.score": "Your result today: {{score}}%",


  "score.perfect": "Perfect!",
  "score.close": "Very close!",
  "score.good": "Good try",
  "score.tryAgain": "Keep trying",

  "run.artist": "Artist's eye!",
  "run.great": "Great aim!",
  "run.good": "Good job",
  "run.practice": "Keep practising",

  "validate.correct": "Correct!",
  "validate.tryAgain": "Keep trying.",

  "settings.title": "Sound settings",
  "settings.music": "Music",
  "settings.sfx": "Effects",
  "settings.close": "Close",

  // --- Online mode -------------------------------------------------------
  "online.session.restoring": "Restoring your session...",
  "online.level": "Level {{level}}",
  "online.xp": "{{xp}} XP",
  "online.xpToNext": "{{xp}} XP to go",

  "online.auth.badge": "Online mode",
  "online.auth.title": "Sign in",
  "online.auth.titleRegister": "Create your account",
  "online.auth.subtitle":
    "You need an account to compete, add friends and show up on the leaderboard.",
  "online.auth.subtitleRegister":
    "Pick a name, save your progress and compete with everyone else.",
  "online.auth.login": "Sign in",
  "online.auth.register": "Sign up",
  "online.auth.username": "Player name",
  "online.auth.usernamePlaceholder": "colorist",
  "online.auth.usernameHint":
    "3 to 24 characters: letters, numbers and . _ - You can change it later.",
  "online.auth.email": "Email",
  "online.auth.emailPlaceholder": "you@email.com",
  "online.auth.emailHint": "The email you signed up with.",
  "online.auth.password": "Password",
  "online.auth.passwordPlaceholder": "••••••••",
  "online.auth.passwordHint": "At least 8 characters.",
  "online.auth.switchToRegister": "No account yet?",
  "online.auth.switchToLogin": "Already have an account?",
  "online.auth.offlineNote":
    "Offline mode keeps working with no account and no connection: your local records stay untouched.",
  "online.auth.error.passwordRequired": "Enter your password.",
  "online.auth.error.passwordShort": "At least {{min}} characters.",
  "online.auth.error.usernameLength": "Between 3 and 24 characters.",
  "online.auth.error.usernameChars": "Only letters, numbers and . _ -",
  "online.auth.error.email": "That email does not look valid.",
  "online.auth.error.code": "The code has {{length}} digits.",
  "online.auth.or": "or",
  "online.auth.google": "Continue with Google",
  "online.auth.apple": "Continue with Apple",
  "online.auth.connecting": "Connecting...",
  "online.auth.unavailable":
    "Online mode is not configured in this build. The rest of the game works as usual.",
  "online.auth.verify.title": "Confirm your email",
  "online.auth.verify.subtitle": "We sent a 6-digit code to {{email}}.",
  "online.auth.verify.code": "Verification code",
  "online.auth.verify.codePlaceholder": "123456",
  "online.auth.verify.hint": "Check your spam folder too.",
  "online.auth.verify.submit": "Confirm",
  "online.auth.verify.resend": "Send another code",
  "online.auth.verify.resent": "Code sent again.",
  "online.auth.verify.back": "Use another email",

  "online.hub.badge": "Online mode",
  "online.hub.title": "How do you\nwant to play?",
  "online.hub.subtitle":
    "Compete with friends in a private group, or see how you rank.",
  "online.hub.globalRank": "Global rank",
  "online.hub.friendsRank": "Among friends",
  "online.hub.ofPlayers": "of {{total}} players",
  "online.hub.friendCount": "{{count}} friends",
  "online.hub.profile.title": "Profile",
  "online.hub.profile.description": "Your level, your XP and your account details.",
  "online.hub.friends.title": "Friends",
  "online.hub.friends.description": "Find players and handle your requests.",
  "online.hub.leaderboard.title": "Leaderboard",
  "online.hub.leaderboard.description": "The global ranking and your friends'.",
  "online.hub.match.title": "Online match",
  "online.hub.match.description": "Compete in real time against other players.",
  "online.hub.match.locked": "Needs real-time matches · in development",

  "online.hub.playSection": "Play",
  "online.hub.playHint":
    "Today's challenge can be played with or without a group.",
  "online.hub.playHintPending":
    "Every group has its own challenge today. You still have some to play.",
  "online.hub.playHintDone": "You have played today's challenge in every group.",
  "online.hub.group.play": "Play the challenge",
  "online.hub.group.played": "Today's challenge played · best {{score}}",
  "online.hub.todayPoints": "Points today",
  "online.hub.todayPointsHint": "Across all your groups",
  "online.hub.accountSection": "Your account",
  "online.hub.accountHint": "Profile, friends and the world ranking.",

  "online.hub.quickCreate": "Create group",
  "online.hub.quickJoin": "I have a code",
  "online.hub.seeAllGroups": "See all my groups",
  "online.hub.groupsEmpty": "You are not in any group yet",
  "online.hub.groupsEmptyHint":
    "Create one and share its code, or join someone else's.",
  "online.hub.moreSection": "More",
  "online.hub.scoreSection": "Your score",
  "online.hub.levelProgress": "{{current}} / {{total}} XP to level {{next}}",
  "online.hub.unranked": "—",

  "online.groups.badge": "Groups",
  "online.groups.title": "Your groups",
  "online.groups.subtitle":
    "Each group competes for 10 days. Once it ends, only its creator can restart it.",
  "online.groups.loading": "Loading your groups...",
  "online.groups.emptyTitle": "You are not in any group yet",
  "online.groups.emptyHint":
    "Create one and invite your friends with the code, or join with the one you were given.",
  "online.groups.tabCreate": "Create",
  "online.groups.tabJoin": "Join",
  "online.groups.nameLabel": "Group name",
  "online.groups.namePlaceholder": "The Brushes",
  "online.groups.nameHint": "Between 2 and 40 characters. Everyone will see it.",
  "online.groups.createSubmit": "Create group",
  "online.groups.codeLabel": "Invite code",
  "online.groups.codePlaceholder": "K7QMBN",
  "online.groups.codeHint": "6 characters. Upper or lower case, it does not matter.",
  "online.groups.joinSubmit": "Join the group",
  "online.groups.created": "Group created. Share the code to invite people.",
  "online.groups.joined": "You are in.",
  "online.groups.mine": "My groups",
  "online.groups.members": "{{count}} members",
  "online.groups.membersOne": "1 member",
  "online.groups.statusActive": "Active",
  "online.groups.statusFinished": "Finished",
  "online.groups.daysLeft": "{{days}} days left",
  "online.groups.lastDay": "Last day",
  "online.groups.endsSoon": "Ends today",
  "online.groups.finishedHint": "Season {{season}} finished",
  "online.groups.unread": "New",

  "online.group.loading": "Loading the group...",
  "online.group.badge": "Group",
  "online.group.season": "Season {{season}}",
  "online.group.codeTitle": "Invite code",
  "online.group.codeHint": "Anyone with it can join the group.",
  "online.group.share": "Share",
  "online.group.shareMessage":
    "Join my Color Quest group \"{{name}}\" with the code {{code}}",
  "online.group.finishedTitle": "This season has ended",
  "online.group.finishedOwner":
    "The ranking is frozen. You can restart it whenever you want: points go back to zero, but your XP and level are untouched.",
  "online.group.finishedMember":
    "The ranking is frozen. Only {{owner}}, who created the group, can start a new season.",
  "online.group.chatStillOpen": "The chat stays open.",
  "online.group.renew": "Start season {{season}}",
  "online.group.renewing": "Starting...",
  "online.group.renewed": "Season {{season}} is on.",
  "online.group.leaderboard": "Ranking",
  "online.group.leaderboardFrozen": "Final result",
  "online.group.leaderboardHint": "Season total.",
  "online.group.leaderboardEmpty": "Nobody has played yet",
  "online.group.leaderboardEmptyHint":
    "Daily challenge scores show up here as soon as someone plays.",
  "online.group.points": "{{points}} pts",
  "online.group.daysPlayed": "{{days}} days",
  "online.group.dayPlayed": "1 day",
  "online.group.notPlayed": "Not played",
  "online.group.you": "You",
  "online.group.owner": "Creator",
  "online.group.members": "Members",
  "online.group.daily.title": "Today's challenge",
  "online.group.daily.attemptsLeft": "{{count}} attempts left",
  "online.group.daily.attemptsOne": "1 attempt left",
  "online.group.daily.noAttempts": "You used both attempts",
  "online.group.daily.best": "Your best score: {{score}}",
  "online.group.daily.play": "Play",
  "online.group.daily.notCounting":
    "You can play the challenge, but it will not count towards this ranking until a new season starts.",
  "online.group.chat.title": "Group chat",
  "online.group.chat.description": "Trash talk while the season lasts.",
  "online.group.chat.soon": "In development",
  "online.group.leave": "Leave group",
  "online.group.leaveOwnerHint":
    "If you leave, the group passes to the oldest member.",
  "online.group.left": "You left the group.",

  "online.daily.badge": "Daily challenge",
  "online.daily.title": "Today's challenge",
  "online.daily.loading": "Loading today's challenge...",
  "online.daily.roundsTitle": "{{count}} images",
  "online.daily.roundsTitleOne": "1 image",
  "online.daily.roundsHint":
    "The same ones for everybody. They change every day at 15:00.",
  "online.daily.statusOpen": "Open",
  "online.daily.statusUsed": "No attempts",
  "online.daily.statusClosed": "Closed",
  "online.daily.attemptsLabel": "Attempts",
  "online.daily.attemptsHint": "{{used}} of 2 used",
  "online.daily.bestLabel": "Your best",
  "online.daily.bestHint": "Points today",
  "online.daily.closesIn": "Closes in",
  "online.daily.nextChallengeIn": "Next challenge in",
  "online.daily.cutHint": "The challenge changes every day at 15:00, Madrid time.",
  "online.daily.countdownDays": "{{days}} d {{hours}} h",
  "online.daily.countdownHours": "{{hours}} h {{minutes}} min",
  "online.daily.countdownMinutes": "{{minutes}} min {{seconds}} s",
  "online.daily.countdownSeconds": "{{seconds}} s",
  "online.daily.closedTitle": "The challenge has closed",
  "online.daily.closedHint":
    "A new day has started. Reload to see today's logos.",
  "online.daily.reload": "Reload",
  "online.daily.noAttemptsTitle": "You already played today",
  "online.daily.noAttemptsHint":
    "Two attempts a day. Come back when the next challenge opens.",
  "online.daily.noActiveGroups": "It does not count in any ranking",
  "online.daily.countsOne": "Counts in 1 ranking",
  "online.daily.countsMany": "Counts in {{count}} rankings",
  "online.daily.noGroupTitle": "This challenge belongs to a group",
  "online.daily.noGroupHint":
    "Every group has its own daily challenge, with different images. Join one to play.",
  "online.daily.countsIn": "Counts in {{group}}",
  "online.daily.countsInHint":
    "Today's score only counts in this group's standings.",
  "online.daily.goToGroup": "See the standings",
  "online.daily.goToGroups": "See my groups",
  "online.daily.play": "Play the challenge",
  "online.daily.playSecond": "Second attempt",
  "online.daily.check": "Check",
  "online.daily.finish": "Send attempt",
  "online.daily.submitting": "Sending your attempt...",
  "online.daily.submitFailed": "The attempt could not be sent",
  "online.daily.submitRetry": "Try sending it again",
  "online.daily.attemptLabel": "Attempt",
  "online.daily.attemptValue": "{{number}} of 2",
  "online.daily.resultTitle": "Attempt result",
  "online.daily.attemptPoints": "Points",
  "online.daily.position": "Position",
  "online.daily.positionHint": "In today's challenge",
  "online.daily.bestIsThis": "This attempt",
  "online.daily.xpEarned": "+{{xp}} XP",
  "online.daily.xpAlready": "Today's XP was already granted",
  "online.daily.attemptsOneLeft": "1 attempt left",
  "online.daily.finishAttempt": "Finish",
  "online.daily.roundPoints": "{{points}} pts",
  "online.daily.roundDetail": "See round {{round}} in detail",
  "online.daily.roundImage": "Image {{round}}",
  "online.daily.missingAsset": "Logo not available",
  "online.daily.rulesTitle": "How it works",
  "online.daily.ruleAttempts": "Two attempts a day; the best one counts.",
  "online.daily.ruleBest":
    "Your best score of the day adds up in every active group.",
  "online.daily.ruleServer":
    "The right color shows up when the attempt closes: the server checks it.",

  "online.dev.title": "Time travel",
  "online.dev.hint":
    "Development only. The offset is lost when the backend restarts.",
  "online.dev.day": "+1 day",
  "online.dev.tenDays": "+10 days",
  "online.dev.endSeason": "End this season",
  "online.dev.reset": "Back to real time",
  "online.dev.offset": "Offset: {{days}} d {{hours}} h",
  "online.dev.realTime": "Real time",

  "online.error.groupNotFound": "That group does not exist, or you are no longer in it.",
  "online.error.groupCodeInvalid": "That code does not exist.",
  "online.error.alreadyMember": "You are already in that group.",
  "online.error.notGroupOwner": "Only the group creator can do that.",
  "online.error.seasonStillActive":
    "The season is still running: it cannot be restarted yet.",

  "online.profile.badge": "Profile",
  "online.profile.title": "Your profile",
  "online.profile.subtitle": "This is how other players see you.",
  "online.profile.account": "Account details",
  "online.profile.memberSince": "Member since",
  "online.profile.nextLevel": "{{xp}} XP to reach level {{level}}.",
  "online.profile.edit": "Change name",
  "online.profile.save": "Save",
  "online.profile.cancel": "Cancel",
  "online.profile.saved": "Name updated.",
  "online.profile.session": "Session",
  "online.profile.sessionHint":
    "Signing out clears the session on this device. Offline mode is unaffected.",
  "online.profile.logout": "Sign out",

  "online.friends.badge": "Friends",
  "online.friends.title": "Your friends",
  "online.friends.subtitle": "Search players by name and add them.",
  "online.friends.searchLabel": "Find players",
  "online.friends.searchPlaceholder": "Username",
  "online.friends.searchHint": "Type at least {{min}} characters.",
  "online.friends.searching": "Searching...",
  "online.friends.noResults": "Nobody matches \u201c{{query}}\u201d.",
  "online.friends.add": "Add",
  "online.friends.you": "That is you",
  "online.friends.alreadyFriend": "Already friends",
  "online.friends.requestSent": "Request sent",
  "online.friends.requestReceived": "They wrote to you",
  "online.friends.incoming": "Incoming requests",
  "online.friends.incomingHint": "Accept to appear in each other's friends ranking.",
  "online.friends.outgoing": "Sent requests",
  "online.friends.accept": "Accept",
  "online.friends.reject": "Decline",
  "online.friends.cancel": "Cancel",
  "online.friends.remove": "Remove",
  "online.friends.list": "Friends",
  "online.friends.listCount": "{{count}} in total.",
  "online.friends.loading": "Loading friends...",
  "online.friends.emptyTitle": "No friends yet",
  "online.friends.emptyHint":
    "Search someone by their username and send them a request.",

  "online.leaderboard.badge": "Leaderboard",
  "online.leaderboard.title": "Ranking",
  "online.leaderboard.subtitle": "Sorted by total XP.",
  "online.leaderboard.global": "Global",
  "online.leaderboard.friends": "Friends",
  "online.leaderboard.total": "{{total}} players",
  "online.leaderboard.you": "you",
  "online.leaderboard.loading": "Loading leaderboard...",
  "online.leaderboard.loadMore": "Show more",
  "online.leaderboard.loadingMore": "Loading...",
  "online.leaderboard.emptyGlobal": "The leaderboard is empty",
  "online.leaderboard.emptyGlobalHint": "Be the first to earn XP.",
  "online.leaderboard.emptyFriends": "No friends on the leaderboard",
  "online.leaderboard.emptyFriendsHint":
    "Add friends and they will show up here sorted by XP.",

  "online.error.generic": "Something went wrong. Try again.",
  "online.error.network":
    "We could not reach the server. Check your connection.",
  "online.error.credentials": "Wrong email or password.",
  "online.error.passwordPwned":
    "That password has shown up in known breaches. Pick another one.",
  "online.error.passwordWeak": "That password is too weak.",
  "online.error.codeIncorrect": "That code is not correct.",
  "online.error.codeExpired": "The code expired. Ask for a new one.",
  "online.error.captcha": "We could not verify that you are a human.",
  "online.error.sessionExists": "You are already signed in.",
  "online.error.emailUsed": "There is already an account with that email.",
  "online.error.usernameUsed": "That username is taken.",
  "online.error.userNotFound": "We could not find that player.",
  "online.error.rateLimited": "Too many attempts. Wait a moment.",
  "online.error.validation": "Check the details you entered.",
  "online.error.sessionExpired": "Your session expired. Sign in again.",
  "online.error.friendExists": "There is already a request with that player.",
  "online.error.friendSelf": "You cannot add yourself.",
  "online.error.friendNotFound": "That request no longer exists.",
  "online.error.dailyClosed":
    "The challenge you were playing has closed. Reload to see today's one.",
  "online.error.noAttemptsLeft": "You already used your two attempts today.",
};

const fr: Record<TranslationKey, string> = {
  "common.back": "Accueil",
  "common.backShort": "Retour",
  "common.exit": "Quitter",
  "common.next": "Suivant",
  "common.retry": "Réessayer",
  "common.share": "Partager",
  "common.loading": "Chargement du jeu...",
  "common.continue": "Continuer",

  "a11y.back": "Revenir",
  "a11y.close": "Fermer",
  "a11y.stars": "{{value}} étoiles sur {{total}}",
  "a11y.rank": "Place {{position}}",
  "a11y.playersDecrease": "Retirer un joueur",
  "a11y.playersIncrease": "Ajouter un joueur",
  "a11y.wheel": "Roue de teinte et saturation",
  "a11y.brightness": "Luminosité",
  "a11y.selectedColor": "Couleur sélectionnée",

  "landing.badge": "Color Quest",
  "landing.title": "Choisis comment\ntu veux jouer",
  "landing.subtitle":
    "Entraîne-toi en solo ou rassemble tes amis autour d'un même téléphone.",
  "landing.online.title": "En ligne",
  "landing.online.description": "Affronte d'autres joueurs en temps réel.",
  "landing.online.locked": "Nécessite une connexion · en développement",
  "landing.offline.title": "Hors ligne",
  "landing.offline.description":
    "Mode entraînement et parties de groupe sur cet appareil.",
  "landing.soon": "Bientôt",
  "landing.footer": "Le mode en ligne arrivera avec la prochaine mise à jour.",

  "offline.badge": "Mode hors ligne",
  "offline.title": "Entraînement & groupe",
  "offline.subtitle":
    "Joue seul ou fais passer le téléphone entre plusieurs personnes.",
  "offline.solo.section": "Un joueur",
  "offline.solo.hint": "Modes d'entraînement pour un joueur.",
  "offline.group.section": "En groupe · même téléphone",
  "offline.group.hint": "Jusqu'à 99 joueurs, chacun son tour.",

  "party.mode.battle.title": "Bataille de devinettes",
  "party.mode.battle.description":
    "5 images à tour de rôle. Le plus proche gagne.",
  "party.mode.battle-timed.title": "Bataille contre la montre",
  "party.mode.battle-timed.description":
    "20 secondes par joueur pour cumuler le plus de réussites.",
  "party.mode.coop.title": "Coopératif",
  "party.mode.coop.description":
    "Additionnez vos scores pour une note commune.",
  "party.mode.coop-timed.title": "Coopératif contre la montre",
  "party.mode.coop-timed.description":
    "20-30 s par joueur selon le nombre ; cumulez tout en équipe.",

  "party.setup.title": "Configure la partie",
  "party.setup.playersLabel": "Nombre de joueurs",
  "party.setup.playersHint": "Entre {{min}} et {{max}} joueurs.",
  "party.setup.namesLabel": "Noms (facultatif)",
  "party.setup.namesHint": "Laisse vide pour utiliser « Joueur N ».",
  "party.setup.battleInfo": "{{count}} images identiques pour tous.",
  "party.setup.coopInfo": "{{count}} images par joueur.",
  "party.setup.timedInfo": "{{seconds}} s par joueur.",
  "party.setup.start": "Commencer la partie",

  "party.playerN": "Joueur {{n}}",

  "party.handoff.title": "Au tour de {{name}}",
  "party.handoff.subtitle": "Passe le téléphone à ce joueur.",
  "party.handoff.image": "Image {{current}} sur {{total}}",
  "party.handoff.timed": "Tu as {{seconds}} secondes.",
  "party.handoff.start": "Je suis prêt",

  "party.play.image": "Image {{current}} sur {{total}}",
  "party.play.solved": "Réussites : {{count}}",
  "party.play.check": "Vérifier",

  "party.guess.title": "Enregistré !",
  "party.guess.hidden": "Passe le téléphone sans regarder la bonne couleur.",

  "party.round.title": "Résultat de l'image",
  "party.round.correct": "Bonne couleur",
  "party.round.you": "{{name}}",

  "party.final.title": "Classement final",
  "party.final.coopTitle": "Résultat de l'équipe",
  "party.final.winner": "{{name}} gagne",
  "party.final.tie": "Égalité !",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} réussites",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Moyenne de l'équipe : {{average}}%",
  "party.final.teamRecord": "Meilleure moyenne de l'équipe : {{average}}%",
  "party.final.teamRecordNew": "Nouveau record de l'équipe !",
  "party.final.contributions": "Contributions",
  "party.final.replay": "Rejouer",
  "party.final.home": "Retour aux modes",

  "home.badge": "Color Quest",
  "home.title": "Mets ton œil\npour la couleur à l'épreuve",
  "home.subtitle":
    "Choisis un mode de jeu et montre à quel point tu approches la couleur parfaite.",
  "home.footer": "D'autres modes de jeu arrivent.",
  "home.soon": "Bientôt",
  "home.best": "Record : {{score}}",
  "home.bestAverage": "Record : {{average}} %",

  "mode.quick.title": "Partie rapide",
  "mode.quick.description":
    "Devine la couleur de chaque défi et passe tous les niveaux.",
  "mode.timed.title": "Contre la montre",
  "mode.timed.description":
    "Devine un maximum de couleurs avant la fin du temps.",
  "mode.daily.title": "Défi quotidien",
  "mode.daily.description":
    "Une nouvelle couleur chaque jour pour tester ton œil.",
  "mode.multicolor.title": "Multicolore",
  "mode.multicolor.description":
    "Reconstitue toutes les couleurs d'un même logo, une par une.",

  "game.kicker": "Color Quest",
  "game.title": "Devine la couleur",
  "game.subtitle":
    "Ajuste le sélecteur jusqu'à ce que le résultat ressemble au défi.",
  "game.check": "Vérifier",
  "game.empty.title": "Aucun défi disponible.",
  "game.empty.subtitle":
    "Vérifie le catalogue généré ou les métadonnées des défis.",
  "game.colorStep": "Couleur {{current}} sur {{total}}",
  "game.runLabel": "Partie",
  "game.hits": "Réussites : {{count}}",
  "game.points": "{{score}} pts",

  "progress.label": "Progression",
  "progress.counter": "Défi {{current}} sur {{total}}",

  "timer.label": "Temps",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Série",
  "streak.value": "{{count}}",

  "result.kicker": "Résultat",
  "result.yours": "Ta couleur",
  "result.target": "Correcte",
  "result.deltaTitle": "Différence",
  "result.hue": "Teinte",
  "result.saturation": "Saturation",
  "result.value": "Luminosité",

  "summary.title": "Jeu terminé",
  "summary.subtitle": "Tu as réussi tous les défis disponibles.",
  "summary.total": "Score total",
  "summary.average": "Moyenne",
  "summary.record": "Nouveau record !",
  "summary.best": "Meilleur : {{score}}",
  "summary.bestStreak": "Meilleure série : {{count}}",
  "summary.points": "Points",
  "summary.hits": "Réussites",
  "summary.hitsOf": "sur {{rounds}} essais",
  "summary.home": "Retour à l'accueil",
  "summary.shareText":
    "🎨 Color Quest — {{mode}}\nScore : {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Color Quest — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} réussites ({{average}}%)\n{{stars}}",

  "daily.done.title": "Défi quotidien terminé",
  "daily.done.subtitle": "Reviens demain pour une nouvelle couleur.",
  "daily.score": "Ton résultat d'aujourd'hui : {{score}}%",


  "score.perfect": "Parfait !",
  "score.close": "Très proche !",
  "score.good": "Bon essai",
  "score.tryAgain": "Continue d'essayer",

  "run.artist": "Œil d'artiste !",
  "run.great": "Super visée !",
  "run.good": "Bon travail",
  "run.practice": "Continue de t'entraîner",

  "validate.correct": "Correct !",
  "validate.tryAgain": "Continue d'essayer.",

  "settings.title": "Réglages du son",
  "settings.music": "Musique",
  "settings.sfx": "Effets",
  "settings.close": "Fermer",

  // --- Mode en ligne -----------------------------------------------------
  "online.session.restoring": "Restauration de ta session...",
  "online.level": "Niveau {{level}}",
  "online.xp": "{{xp}} XP",
  "online.xpToNext": "Encore {{xp}} XP",

  "online.auth.badge": "Mode en ligne",
  "online.auth.title": "Connexion",
  "online.auth.titleRegister": "Cree ton compte",
  "online.auth.subtitle":
    "Il te faut un compte pour jouer, avoir des amis et figurer au classement.",
  "online.auth.subtitleRegister":
    "Choisis un nom, garde ta progression et affronte les autres joueurs.",
  "online.auth.login": "Se connecter",
  "online.auth.register": "S'inscrire",
  "online.auth.username": "Pseudo",
  "online.auth.usernamePlaceholder": "coloriste",
  "online.auth.usernameHint":
    "De 3 a 24 caracteres : lettres, chiffres et . _ - Tu pourras le changer.",
  "online.auth.email": "Email",
  "online.auth.emailPlaceholder": "toi@email.com",
  "online.auth.emailHint": "L'email utilise a la creation du compte.",
  "online.auth.password": "Mot de passe",
  "online.auth.passwordPlaceholder": "••••••••",
  "online.auth.passwordHint": "8 caracteres minimum.",
  "online.auth.switchToRegister": "Pas encore de compte ?",
  "online.auth.switchToLogin": "Deja un compte ?",
  "online.auth.offlineNote":
    "Le mode hors ligne fonctionne toujours sans compte ni connexion : tes records locaux ne bougent pas.",
  "online.auth.error.passwordRequired": "Saisis ton mot de passe.",
  "online.auth.error.passwordShort": "{{min}} caracteres minimum.",
  "online.auth.error.usernameLength": "Entre 3 et 24 caracteres.",
  "online.auth.error.usernameChars": "Uniquement lettres, chiffres et . _ -",
  "online.auth.error.email": "Cet email ne semble pas valide.",
  "online.auth.error.code": "Le code contient {{length}} chiffres.",
  "online.auth.or": "ou",
  "online.auth.google": "Continuer avec Google",
  "online.auth.apple": "Continuer avec Apple",
  "online.auth.connecting": "Connexion...",
  "online.auth.unavailable":
    "Le mode en ligne n'est pas configure dans cette version. Le reste du jeu fonctionne normalement.",
  "online.auth.verify.title": "Confirme ton email",
  "online.auth.verify.subtitle":
    "Nous avons envoye un code a 6 chiffres a {{email}}.",
  "online.auth.verify.code": "Code de verification",
  "online.auth.verify.codePlaceholder": "123456",
  "online.auth.verify.hint": "Regarde aussi dans les spams.",
  "online.auth.verify.submit": "Confirmer",
  "online.auth.verify.resend": "Envoyer un autre code",
  "online.auth.verify.resent": "Code renvoye.",
  "online.auth.verify.back": "Changer d'email",

  "online.hub.badge": "Mode en ligne",
  "online.hub.title": "Comment veux-tu\njouer ?",
  "online.hub.subtitle":
    "Affronte tes amis dans un groupe prive, ou regarde ton classement.",
  "online.hub.globalRank": "Rang mondial",
  "online.hub.friendsRank": "Parmi tes amis",
  "online.hub.ofPlayers": "sur {{total}} joueurs",
  "online.hub.friendCount": "{{count}} amis",
  "online.hub.profile.title": "Profil",
  "online.hub.profile.description": "Ton niveau, ton XP et les donnees du compte.",
  "online.hub.friends.title": "Amis",
  "online.hub.friends.description": "Cherche des joueurs et gere tes demandes.",
  "online.hub.leaderboard.title": "Classement",
  "online.hub.leaderboard.description": "Le classement mondial et celui de tes amis.",
  "online.hub.match.title": "Partie en ligne",
  "online.hub.match.description": "Affronte d'autres joueurs en temps reel.",
  "online.hub.match.locked": "Necessite les parties en temps reel · en cours",

  "online.hub.playSection": "Jouer",
  "online.hub.playHint": "Le defi du jour se joue avec ou sans groupe.",
  "online.hub.playHintPending":
    "Chaque groupe a son propre defi du jour. Il t'en reste a jouer.",
  "online.hub.playHintDone": "Tu as joue le defi du jour dans tous tes groupes.",
  "online.hub.group.play": "Jouer le defi",
  "online.hub.group.played": "Defi du jour joue · meilleur {{score}}",
  "online.hub.todayPoints": "Points du jour",
  "online.hub.todayPointsHint": "Tous groupes confondus",
  "online.hub.accountSection": "Ton compte",
  "online.hub.accountHint": "Profil, amis et classement mondial.",

  "online.hub.quickCreate": "Créer un groupe",
  "online.hub.quickJoin": "J'ai un code",
  "online.hub.seeAllGroups": "Voir tous mes groupes",
  "online.hub.groupsEmpty": "Tu n'es encore dans aucun groupe",
  "online.hub.groupsEmptyHint":
    "Cree-en un et partage son code, ou rejoins celui de quelqu'un.",
  "online.hub.moreSection": "Plus",
  "online.hub.scoreSection": "Ton score",
  "online.hub.levelProgress": "{{current}} / {{total}} XP pour le niveau {{next}}",
  "online.hub.unranked": "—",

  "online.groups.badge": "Groupes",
  "online.groups.title": "Tes groupes",
  "online.groups.subtitle":
    "Chaque groupe joue 10 jours. Une fois terminé, seul son créateur peut le relancer.",
  "online.groups.loading": "Chargement de tes groupes...",
  "online.groups.emptyTitle": "Tu n'es encore dans aucun groupe",
  "online.groups.emptyHint":
    "Crée-en un et invite tes amis avec le code, ou rejoins avec celui qu'on t'a donné.",
  "online.groups.tabCreate": "Créer",
  "online.groups.tabJoin": "Rejoindre",
  "online.groups.nameLabel": "Nom du groupe",
  "online.groups.namePlaceholder": "Les Pinceaux",
  "online.groups.nameHint": "Entre 2 et 40 caractères. Tout le monde le verra.",
  "online.groups.createSubmit": "Créer le groupe",
  "online.groups.codeLabel": "Code d'invitation",
  "online.groups.codePlaceholder": "K7QMBN",
  "online.groups.codeHint": "6 caractères. Majuscules ou minuscules, peu importe.",
  "online.groups.joinSubmit": "Rejoindre le groupe",
  "online.groups.created": "Groupe créé. Partage le code pour inviter.",
  "online.groups.joined": "Tu y es.",
  "online.groups.mine": "Mes groupes",
  "online.groups.members": "{{count}} membres",
  "online.groups.membersOne": "1 membre",
  "online.groups.statusActive": "Actif",
  "online.groups.statusFinished": "Terminé",
  "online.groups.daysLeft": "{{days}} jours restants",
  "online.groups.lastDay": "Dernier jour",
  "online.groups.endsSoon": "Se termine aujourd'hui",
  "online.groups.finishedHint": "Saison {{season}} terminée",
  "online.groups.unread": "Nouveau",

  "online.group.loading": "Chargement du groupe...",
  "online.group.badge": "Groupe",
  "online.group.season": "Saison {{season}}",
  "online.group.codeTitle": "Code d'invitation",
  "online.group.codeHint": "Qui l'a peut rejoindre le groupe.",
  "online.group.share": "Partager",
  "online.group.shareMessage":
    "Rejoins mon groupe Color Quest « {{name}} » avec le code {{code}}",
  "online.group.finishedTitle": "Cette saison est terminée",
  "online.group.finishedOwner":
    "Le classement est figé. Tu peux le relancer quand tu veux : les points repartent à zéro, mais ton XP et ton niveau ne bougent pas.",
  "online.group.finishedMember":
    "Le classement est figé. Seul {{owner}}, qui a créé le groupe, peut lancer une nouvelle saison.",
  "online.group.chatStillOpen": "Le chat reste ouvert.",
  "online.group.renew": "Lancer la saison {{season}}",
  "online.group.renewing": "Lancement...",
  "online.group.renewed": "Saison {{season}} lancée.",
  "online.group.leaderboard": "Classement",
  "online.group.leaderboardFrozen": "Résultat final",
  "online.group.leaderboardHint": "Total de la saison.",
  "online.group.leaderboardEmpty": "Personne n'a encore joué",
  "online.group.leaderboardEmptyHint":
    "Les scores du défi quotidien apparaissent ici dès que quelqu'un joue.",
  "online.group.points": "{{points}} pts",
  "online.group.daysPlayed": "{{days}} journées",
  "online.group.dayPlayed": "1 journée",
  "online.group.notPlayed": "Pas joué",
  "online.group.you": "Toi",
  "online.group.owner": "Créateur",
  "online.group.members": "Membres",
  "online.group.daily.title": "Défi du jour",
  "online.group.daily.attemptsLeft": "Il te reste {{count}} essais",
  "online.group.daily.attemptsOne": "Il te reste 1 essai",
  "online.group.daily.noAttempts": "Tu as utilisé tes deux essais",
  "online.group.daily.best": "Ton meilleur score : {{score}}",
  "online.group.daily.play": "Jouer",
  "online.group.daily.notCounting":
    "Tu peux jouer le défi, mais il ne comptera pas dans ce classement tant qu'une nouvelle saison n'aura pas commencé.",
  "online.group.chat.title": "Chat du groupe",
  "online.group.chat.description": "Chambrez-vous pendant la saison.",
  "online.group.chat.soon": "En cours",
  "online.group.leave": "Quitter le groupe",
  "online.group.leaveOwnerHint":
    "Si tu pars, le groupe passe au membre le plus ancien.",
  "online.group.left": "Tu as quitté le groupe.",

  "online.daily.badge": "Defi du jour",
  "online.daily.title": "Le defi du jour",
  "online.daily.loading": "Chargement du defi du jour...",
  "online.daily.roundsTitle": "{{count}} images",
  "online.daily.roundsTitleOne": "1 image",
  "online.daily.roundsHint":
    "Les memes pour tout le monde. Elles changent chaque jour a 15h00.",
  "online.daily.statusOpen": "Ouvert",
  "online.daily.statusUsed": "Plus d'essais",
  "online.daily.statusClosed": "Ferme",
  "online.daily.attemptsLabel": "Essais",
  "online.daily.attemptsHint": "{{used}} sur 2 utilises",
  "online.daily.bestLabel": "Ton meilleur",
  "online.daily.bestHint": "Points du jour",
  "online.daily.closesIn": "Se ferme dans",
  "online.daily.nextChallengeIn": "Prochain defi dans",
  "online.daily.cutHint": "Le defi change chaque jour a 15h00, heure de Madrid.",
  "online.daily.countdownDays": "{{days}} j {{hours}} h",
  "online.daily.countdownHours": "{{hours}} h {{minutes}} min",
  "online.daily.countdownMinutes": "{{minutes}} min {{seconds}} s",
  "online.daily.countdownSeconds": "{{seconds}} s",
  "online.daily.closedTitle": "Le defi est ferme",
  "online.daily.closedHint":
    "Une nouvelle journee a commence. Recharge pour voir les logos du jour.",
  "online.daily.reload": "Recharger",
  "online.daily.noAttemptsTitle": "Tu as deja joue aujourd'hui",
  "online.daily.noAttemptsHint":
    "Deux essais par journee. Reviens a l'ouverture du prochain defi.",
  "online.daily.noActiveGroups": "Ne compte dans aucun classement",
  "online.daily.countsOne": "Compte dans 1 classement",
  "online.daily.countsMany": "Compte dans {{count}} classements",
  "online.daily.noGroupTitle": "Ce defi appartient a un groupe",
  "online.daily.noGroupHint":
    "Chaque groupe a son propre defi quotidien, avec d'autres images. Rejoins-en un pour jouer.",
  "online.daily.countsIn": "Compte dans {{group}}",
  "online.daily.countsInHint":
    "Le score du jour compte uniquement dans le classement de ce groupe.",
  "online.daily.goToGroup": "Voir le classement",
  "online.daily.goToGroups": "Voir mes groupes",
  "online.daily.play": "Jouer le defi",
  "online.daily.playSecond": "Deuxieme essai",
  "online.daily.check": "Verifier",
  "online.daily.finish": "Envoyer l'essai",
  "online.daily.submitting": "Envoi de ton essai...",
  "online.daily.submitFailed": "Impossible d'envoyer l'essai",
  "online.daily.submitRetry": "Reessayer l'envoi",
  "online.daily.attemptLabel": "Essai",
  "online.daily.attemptValue": "{{number}} sur 2",
  "online.daily.resultTitle": "Resultat de l'essai",
  "online.daily.attemptPoints": "Points",
  "online.daily.position": "Place",
  "online.daily.positionHint": "Dans le defi du jour",
  "online.daily.bestIsThis": "C'est cet essai",
  "online.daily.xpEarned": "+{{xp}} XP",
  "online.daily.xpAlready": "L'XP du jour etait deja accorde",
  "online.daily.attemptsOneLeft": "Il te reste 1 essai",
  "online.daily.finishAttempt": "Terminer",
  "online.daily.roundPoints": "{{points}} pts",
  "online.daily.roundDetail": "Voir le detail de la manche {{round}}",
  "online.daily.roundImage": "Image {{round}}",
  "online.daily.missingAsset": "Logo indisponible",
  "online.daily.rulesTitle": "Comment ca marche",
  "online.daily.ruleAttempts": "Deux essais par journee ; le meilleur compte.",
  "online.daily.ruleBest":
    "Ton meilleur score du jour compte dans chaque groupe actif.",
  "online.daily.ruleServer":
    "La bonne couleur apparait a la fin de l'essai : c'est le serveur qui verifie.",

  "online.dev.title": "Voyage dans le temps",
  "online.dev.hint":
    "Développement uniquement. Le décalage est perdu au redémarrage du backend.",
  "online.dev.day": "+1 jour",
  "online.dev.tenDays": "+10 jours",
  "online.dev.endSeason": "Terminer cette saison",
  "online.dev.reset": "Revenir au temps réel",
  "online.dev.offset": "Décalage : {{days}} j {{hours}} h",
  "online.dev.realTime": "Temps réel",

  "online.error.groupNotFound": "Ce groupe n'existe pas, ou tu n'y es plus.",
  "online.error.groupCodeInvalid": "Ce code n'existe pas.",
  "online.error.alreadyMember": "Tu es déjà dans ce groupe.",
  "online.error.notGroupOwner": "Seul le créateur du groupe peut faire ça.",
  "online.error.seasonStillActive":
    "La saison est toujours en cours : impossible de la relancer pour l'instant.",

  "online.profile.badge": "Profil",
  "online.profile.title": "Ton profil",
  "online.profile.subtitle": "Voila comment les autres joueurs te voient.",
  "online.profile.account": "Donnees du compte",
  "online.profile.memberSince": "Membre depuis",
  "online.profile.nextLevel": "Encore {{xp}} XP pour le niveau {{level}}.",
  "online.profile.edit": "Changer de nom",
  "online.profile.save": "Enregistrer",
  "online.profile.cancel": "Annuler",
  "online.profile.saved": "Nom mis a jour.",
  "online.profile.session": "Session",
  "online.profile.sessionHint":
    "La deconnexion efface la session de cet appareil. Le mode hors ligne n'est pas touche.",
  "online.profile.logout": "Se deconnecter",

  "online.friends.badge": "Amis",
  "online.friends.title": "Tes amis",
  "online.friends.subtitle": "Cherche des joueurs par leur nom et ajoute-les.",
  "online.friends.searchLabel": "Chercher des joueurs",
  "online.friends.searchPlaceholder": "Pseudo",
  "online.friends.searchHint": "Saisis au moins {{min}} caracteres.",
  "online.friends.searching": "Recherche...",
  "online.friends.noResults": "Personne ne correspond a \u00ab {{query}} \u00bb.",
  "online.friends.add": "Ajouter",
  "online.friends.you": "C'est toi",
  "online.friends.alreadyFriend": "Deja amis",
  "online.friends.requestSent": "Demande envoyee",
  "online.friends.requestReceived": "Il t'a ecrit",
  "online.friends.incoming": "Demandes recues",
  "online.friends.incomingHint": "Accepte pour apparaitre dans vos classements d'amis.",
  "online.friends.outgoing": "Demandes envoyees",
  "online.friends.accept": "Accepter",
  "online.friends.reject": "Refuser",
  "online.friends.cancel": "Annuler",
  "online.friends.remove": "Supprimer",
  "online.friends.list": "Amis",
  "online.friends.listCount": "{{count}} au total.",
  "online.friends.loading": "Chargement des amis...",
  "online.friends.emptyTitle": "Pas encore d'amis",
  "online.friends.emptyHint":
    "Cherche quelqu'un par son pseudo et envoie-lui une demande.",

  "online.leaderboard.badge": "Classement",
  "online.leaderboard.title": "Classement",
  "online.leaderboard.subtitle": "Trie par XP cumulee.",
  "online.leaderboard.global": "Mondial",
  "online.leaderboard.friends": "Amis",
  "online.leaderboard.total": "{{total}} joueurs",
  "online.leaderboard.you": "toi",
  "online.leaderboard.loading": "Chargement du classement...",
  "online.leaderboard.loadMore": "Voir plus",
  "online.leaderboard.loadingMore": "Chargement...",
  "online.leaderboard.emptyGlobal": "Le classement est vide",
  "online.leaderboard.emptyGlobalHint": "Sois le premier a gagner de l'XP.",
  "online.leaderboard.emptyFriends": "Aucun ami au classement",
  "online.leaderboard.emptyFriendsHint":
    "Ajoute des amis et ils apparaitront ici, tries par XP.",

  "online.error.generic": "Quelque chose a mal tourne. Reessaie.",
  "online.error.network":
    "Impossible de joindre le serveur. Verifie ta connexion.",
  "online.error.credentials": "Email ou mot de passe incorrect.",
  "online.error.passwordPwned":
    "Ce mot de passe apparait dans des fuites connues. Choisis-en un autre.",
  "online.error.passwordWeak": "Ce mot de passe est trop faible.",
  "online.error.codeIncorrect": "Ce code n'est pas correct.",
  "online.error.codeExpired": "Le code a expire. Demandes-en un nouveau.",
  "online.error.captcha": "Nous n'avons pas pu verifier que tu es humain.",
  "online.error.sessionExists": "Tu es deja connecte.",
  "online.error.emailUsed": "Un compte utilise deja cet email.",
  "online.error.usernameUsed": "Ce pseudo est deja pris.",
  "online.error.userNotFound": "Joueur introuvable.",
  "online.error.rateLimited": "Trop de tentatives. Patiente un instant.",
  "online.error.validation": "Verifie les informations saisies.",
  "online.error.sessionExpired": "Ta session a expire. Reconnecte-toi.",
  "online.error.friendExists": "Une demande existe deja avec ce joueur.",
  "online.error.friendSelf": "Tu ne peux pas t'ajouter toi-meme.",
  "online.error.friendNotFound": "Cette demande n'existe plus.",
  "online.error.dailyClosed":
    "Le defi que tu jouais est ferme. Recharge pour voir celui du jour.",
  "online.error.noAttemptsLeft": "Tu as deja utilise tes deux essais du jour.",
};

const resources: Record<string, Partial<Record<TranslationKey, string>>> = {
  es,
  en,
  fr,
};

function detectLocale(): string {
  try {
    const [primary] = getLocales();
    const tag = primary?.languageCode ?? "es";
    return resources[tag] ? tag : "es";
  } catch {
    return "es";
  }
}

let activeLocale = detectLocale();

export function setLocale(locale: string): void {
  if (resources[locale]) {
    activeLocale = locale;
  }
}

export function getLocale(): string {
  return activeLocale;
}

function interpolate(template: string, params?: Params): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`,
  );
}

export function t(key: TranslationKey, params?: Params): string {
  const dictionary = resources[activeLocale] ?? es;
  const template = dictionary[key] ?? es[key] ?? key;
  return interpolate(template, params);
}
