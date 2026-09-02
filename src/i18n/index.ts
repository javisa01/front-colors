import { useSyncExternalStore } from "react";

import { getLocales } from "expo-localization";

/**
 * Capa de i18n, ligera y a mano.
 *
 * La app va en **español, inglés, francés y catalán**. El español (`es`) es la
 * fuente de verdad y la reserva; los demás diccionarios son espejos suyos, y el
 * tipo lo impone: `TranslationKey` sale de `keyof typeof es`, así que añadir una
 * clave al español **obliga** a ponerla en los otros tres o el typecheck falla.
 * Es lo que evita que una pantalla nueva salga a medio traducir.
 *
 * Toda cadena visible pasa por `t()`. Añadir un idioma es soltar otro
 * diccionario en `resources`, al final del fichero. La interpolación usa
 * `{{nombre}}` y nada más.
 *
 * `expo-localization` solo sirve para detectar el idioma del dispositivo: si un
 * teléfono viene en un idioma que no está aquí, se cae al español. Ese es el
 * valor de partida, no una condena: desde los ajustes se puede elegir cualquiera
 * de los cuatro (`LOCALES`), y la elección se guarda en el teléfono.
 */

type Params = Record<string, string | number>;

const es = {
  "common.back": "Inicio",
  "common.exit": "Salir",
  "common.next": "Siguiente",
  "common.retry": "Reintentar",
  "common.share": "Compartir",
  "common.loading": "Cargando juego...",
  "common.continue": "Continuar",
  "challenge.imageMissing": "Imagen no disponible",

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

  "landing.badge": "Hexy",
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
  "landing.footer": "Offline funciona sin conexión; online necesita cuenta.",

  // --- Bienvenida y tutorial de la primera vez ---------------------------
  "welcome.greeting": "Te doy la bienvenida a",
  "welcome.name": "Hexy",
  "welcome.cta": "Haz clic en los círculos para continuar",
  "welcome.continue": "Continuar",
  "tutorial.memorize": "Memoriza el color",
  "tutorial.findLabel": "Ahora",
  "tutorial.findTitle": "Encuéntralo",
  "tutorial.accuracy": "Precisión",
  "tutorial.resultNote": "Cuenta cuánto te acercas.",
  "tutorial.next": "Siguiente",
  "tutorial.check": "Comprobar",
  "tutorial.start": "Empezar",
  "tutorial.skip": "Saltar",
  "tutorial.chipHole": "Hueco",
  "tutorial.chipMine": "Tuyo",
  "tutorial.chipReal": "Real",
  "dev.tutorialTitle": "Tutorial",
  "dev.tutorialHint": "Solo en desarrollo. Se quita antes de publicar.",
  "dev.tutorialButton": "Ver el tutorial otra vez",

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
    "🎨 Hexy — {{mode}}\nPuntuación: {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Hexy — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} aciertos ({{average}}%)\n{{stars}}",

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

  "settings.title": "Ajustes",
  "settings.sound": "Sonido",
  "settings.music": "Música",
  "settings.sfx": "Efectos",
  "settings.language": "Idioma",
  "settings.languageHint":
    "Se usa el del dispositivo hasta que elijas otro. El cambio se aplica al cerrar.",

  // --- Modo online -------------------------------------------------------
  "online.session.restoring": "Recuperando tu sesión...",
  "online.level": "Nivel {{level}}",
  "online.xp": "{{xp}} XP",

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

  "online.hub.playSection": "Jugar",
  "online.hub.playHintDone": "Ya has jugado el reto de hoy en todos tus grupos.",
  "online.hub.group.played": "Reto de hoy jugado · mejor {{score}}",
  "online.hub.todayPoints": "Puntos de hoy",

  "online.hub.dayLeft": "Te quedan {{count}} retos",
  "online.hub.dayLeftOne": "Te queda 1 reto",
  "online.hub.dayDone": "Jornada completa",
  "online.hub.streakDays": "{{count}} días seguidos",
  "online.hub.streakToday": "Hoy ya cuenta",
  "online.hub.streakPending": "Hoy aún no cuenta",
  "online.hub.tileDone": "Reto hecho",
  "online.hub.tileClosed": "Cerrado por hoy",
  "online.hub.tileOpenHint": "Abre el grupo y su clasificación",
  "online.hub.quickCreate": "Crear grupo",
  "online.hub.quickJoin": "Tengo un código",
  "online.hub.seeAllGroups": "Ver todos mis grupos",
  "online.hub.groupsEmpty": "Crea tu grupo y reta a quien quieras",
  "online.hub.groupsEmptyHint":
    "Cada día, un logo y un color que acertar. Compites solo con la gente que invites.",
  "online.hub.unranked": "—",

  // --- Barra de pestañas del modo online ---
  "online.tabs.today": "Hoy",
  "online.tabs.groups": "Grupos",
  "online.tabs.ranking": "Ranking",
  "online.tabs.profile": "Perfil",

  // --- El reto de hoy, en el menú ---
  "online.hub.queueDone": "Todo jugado · {{total}} grupos",
  "online.hub.allDoneHint": "Ya has jugado en todos tus grupos. El siguiente reto abre a las 15:00.",
  "online.hub.attempts": "Te quedan {{count}} intentos",
  "online.hub.attemptsOne": "Te queda 1 intento",
  "online.hub.streakSecured": "Racha de {{count}} jornadas, asegurada hoy",
  "online.hub.streakAtRisk": "Racha de {{count}} jornadas. Hoy aún no has jugado",

  "online.hub.loading": "Buscando lo que tienes que jugar hoy...",

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
  "online.groups.unreadOneA11y": "Tiene 1 aviso sin leer",
  "online.groups.unreadA11y": "Tiene {{count}} avisos sin leer",

  "online.group.loading": "Cargando el grupo...",
  "online.group.badge": "Grupo",
  "online.group.season": "Temporada {{season}}",
  "online.group.seasonRange": "{{from}} – {{to}}",
  "online.group.seasonCurrent": "En curso",
  "online.group.codeTitle": "Código de invitación",
  "online.group.codeHint": "Quien lo tenga puede entrar en el grupo.",
  "online.group.shareMessage":
    "Entra en mi grupo «{{name}}» de Hexy con el código {{code}}",
  "online.group.finishedTitle": "Esta temporada ha terminado",
  "online.group.finishedOwner":
    "La clasificación queda congelada. Puedes reiniciarla cuando quieras: los puntos vuelven a cero, pero tu XP y tu nivel no se tocan.",
  "online.group.finishedMember":
    "La clasificación queda congelada. Solo {{owner}}, que creó el grupo, puede empezar una temporada nueva.",
  "online.group.chatStillOpen": "El chat sigue abierto.",
  "online.group.renew": "Empezar temporada {{season}}",
  "online.group.renewed": "Temporada {{season}} en marcha.",
  "online.group.leaderboard": "Clasificación",
  "online.group.leaderboardFrozen": "Resultado final",
  "online.group.leaderboardFrozenHint":
    "Congelada hasta que se renueve la temporada.",
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
  "online.group.daily.attemptsOne": "Te queda 1 intento",
  "online.group.daily.noAttempts": "Ya has usado tus dos intentos",
  "online.group.daily.attemptsBoth": "Tienes dos intentos",
  "online.group.daily.closesIn": "Cierra en {{time}}",
  "online.group.daily.rule": "Cuenta el mejor de los dos intentos.",
  "online.group.daily.streakA11y":
    "Tu racha: {{count}} días seguidos jugando, en todos tus grupos",
  "online.group.chat.title": "Chat del grupo",
  "online.group.chat.empty": "Todavía no ha escrito nadie",
  "online.group.chat.unread": "Sin leer",
  "online.group.notice.seasonRenewed":
    "La temporada {{season}} ya está en marcha. La clasificación empieza de cero.",
  "online.group.notice.generic": "Hay novedades en este grupo.",
  "online.group.leave": "Salir del grupo",
  "online.group.leaveOwnerHint":
    "Si te vas, el grupo pasa al miembro más antiguo.",
  "online.group.edit": "Ajustes del grupo",
  "online.group.settings.title": "Ajustes del grupo",
  "online.group.settings.saveName": "Guardar nombre",
  "online.group.settings.renamed": "Nombre cambiado.",
  "online.group.settings.ownerOnly":
    "Solo quien creó el grupo puede cambiarle el nombre.",
  "online.group.settings.notifications": "Avisos de este grupo",
  "online.group.settings.notificationsHint":
    "Enciende el punto rojo cuando pasa algo aquí, como una temporada nueva. Apagado, el grupo no te llama la atención.",
  "online.group.settings.seasons": "Temporadas",
  "online.group.settings.seasonsHint":
    "Cuántas lleva el grupo, y desde cuándo.",
  "online.group.settings.membersHint": "Puntos y jornadas de esta temporada.",
  "online.group.settings.addFriend": "Añadir a {{name}} como amigo",
  "online.group.settings.shareCode": "Compartir el código",
  "online.group.settings.leaveHint":
    "Puedes volver a entrar con el código.",

  "online.chat.badge": "Chat",
  "online.chat.title": "Conversación",
  "online.chat.loading": "Cargando la conversación...",
  "online.chat.loadingOlder": "Trayendo lo anterior...",
  "online.chat.emptyTitle": "Aquí no ha escrito nadie",
  "online.chat.emptyHint": "Escribe lo primero. Lo verá todo el grupo.",
  "online.chat.placeholder": "Escribe al grupo",
  "online.chat.send": "Enviar el mensaje",
  "online.chat.sending": "Enviando",
  "online.chat.failed": "No se envió",
  "online.chat.retry": "Reintentar",
  "online.chat.discard": "Descartar",
  "online.chat.stale":
    "No llega lo nuevo. Aparecerá en cuanto vuelva la conexión.",
  "online.chat.remaining": "Quedan {{count}}",
  "online.chat.tooLong": "Te sobran {{count}}",
  "online.chat.today": "Hoy",
  "online.chat.yesterday": "Ayer",
  "online.chat.finishedHint": "Temporada terminada. El chat sigue abierto.",
  "online.chat.preview": "{{name}}: {{body}}",
  "online.chat.previewMine": "Tú: {{body}}",
  "online.chat.messageA11y": "{{name}}, {{time}}: {{body}}",

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
  "online.daily.levelUp": "Has subido al nivel {{level}}.",
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
  "online.profile.friends": "Amigos",
  "online.profile.friendsHint": "Tus solicitudes y tu lista.",
  "online.profile.friendsWaiting": "{{count}} esperando respuesta",
  "online.profile.friendsLoading": "Cargando tus amigos...",
  "online.profile.friendsUnknown": "No hemos podido saber quién te espera.",
  "online.profile.friendsNone": "No tienes solicitudes pendientes.",
  "online.profile.friendsOpen": "Ver amigos y buscar jugadores",
  "online.profile.wantsToBeFriends": "Quiere ser tu amigo",
  "online.profile.account": "Datos de la cuenta",
  "online.profile.memberSince": "Miembro desde",
  "online.profile.nextLevel": "Faltan {{xp}} XP para el nivel {{level}}.",
  "online.profile.dailyToday": "Hoy has ganado {{xp}} XP con el reto.",
  "online.profile.dailyPlayed": "Hoy ya has jugado el reto.",
  "online.profile.dailyPending": "El reto de hoy todavía no te ha dado XP.",
  "online.profile.streakA11y": "{{count}} días seguidos jugando el reto",
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
  "online.friends.pendingOneA11y": "Tienes 1 solicitud de amistad",
  "online.friends.pendingA11y":
    "Tienes {{count}} solicitudes de amistad",
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

  "online.error.generic": "El servidor ha respondido con un error inesperado.",
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
  "common.exit": "Exit",
  "common.next": "Next",
  "common.retry": "Retry",
  "common.share": "Share",
  "common.loading": "Loading game...",
  "common.continue": "Continue",
  "challenge.imageMissing": "Image unavailable",

  "a11y.back": "Go back",
  "a11y.close": "Close",
  "a11y.stars": "{{value}} out of {{total}} stars",
  "a11y.rank": "Rank {{position}}",
  "a11y.playersDecrease": "Remove a player",
  "a11y.playersIncrease": "Add a player",
  "a11y.wheel": "Hue and saturation wheel",
  "a11y.brightness": "Brightness",
  "a11y.selectedColor": "Selected colour",

  "landing.badge": "Hexy",
  "landing.title": "Choose how\nyou want to play",
  "landing.subtitle":
    "Practise on your own or gather your friends around a single phone.",
  "landing.online.title": "Online",
  "landing.online.description": "Compete against other players in real time.",
  "landing.online.locked": "Needs an internet connection",
  "landing.offline.title": "Offline",
  "landing.offline.description":
    "Practice mode and group matches on this device.",
  "landing.footer": "Offline works with no connection; online needs an account.",

  // --- Bienvenida y tutorial de la primera vez ---------------------------
  "welcome.greeting": "Welcome to",
  "welcome.name": "Hexy",
  "welcome.cta": "Tap the circles to continue",
  "welcome.continue": "Continue",
  "tutorial.memorize": "Memorize the color",
  "tutorial.findLabel": "Now",
  "tutorial.findTitle": "Find it",
  "tutorial.accuracy": "Accuracy",
  "tutorial.resultNote": "It scores how close you get.",
  "tutorial.next": "Next",
  "tutorial.check": "Check",
  "tutorial.start": "Start",
  "tutorial.skip": "Skip",
  "tutorial.chipHole": "Gap",
  "tutorial.chipMine": "Yours",
  "tutorial.chipReal": "Real",
  "dev.tutorialTitle": "Tutorial",
  "dev.tutorialHint": "Development only. It goes before release.",
  "dev.tutorialButton": "Show the tutorial again",

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
    "🎨 Hexy — {{mode}}\nScore: {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Hexy — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} hits ({{average}}%)\n{{stars}}",

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

  "settings.title": "Settings",
  "settings.sound": "Sound",
  "settings.music": "Music",
  "settings.sfx": "Effects",
  "settings.language": "Language",
  "settings.languageHint":
    "Your device language is used until you pick another. The change applies when you close this.",

  // --- Online mode -------------------------------------------------------
  "online.session.restoring": "Restoring your session...",
  "online.level": "Level {{level}}",
  "online.xp": "{{xp}} XP",

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

  "online.hub.playSection": "Play",
  "online.hub.playHintDone": "You have played today's challenge in every group.",
  "online.hub.group.played": "Today's challenge played · best {{score}}",
  "online.hub.todayPoints": "Points today",

  "online.hub.dayLeft": "{{count}} challenges left today",
  "online.hub.dayLeftOne": "1 challenge left today",
  "online.hub.dayDone": "Day complete",
  "online.hub.streakDays": "{{count}} days in a row",
  "online.hub.streakToday": "Today counts",
  "online.hub.streakPending": "Today does not count yet",
  "online.hub.tileDone": "Challenge done",
  "online.hub.tileClosed": "Closed for today",
  "online.hub.tileOpenHint": "Opens the group and its standings",
  "online.hub.quickCreate": "Create group",
  "online.hub.quickJoin": "I have a code",
  "online.hub.seeAllGroups": "See all my groups",
  "online.hub.groupsEmpty": "Create a group and challenge whoever you like",
  "online.hub.groupsEmptyHint":
    "One logo, one color to match, every day. You only compete with the people you invite.",
  "online.hub.unranked": "—",

  "online.tabs.today": "Today",
  "online.tabs.groups": "Groups",
  "online.tabs.ranking": "Ranking",
  "online.tabs.profile": "Profile",

  "online.hub.queueDone": "All played · {{total}} groups",
  "online.hub.allDoneHint": "You have played in every group. The next challenge opens at 15:00.",
  "online.hub.attempts": "{{count}} attempts left",
  "online.hub.attemptsOne": "1 attempt left",
  "online.hub.streakSecured": "{{count}} day streak, secured today",
  "online.hub.streakAtRisk": "{{count}} day streak. You have not played today",

  "online.hub.loading": "Looking up what you have to play today...",

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
  "online.groups.unreadOneA11y": "Has 1 unread alert",
  "online.groups.unreadA11y": "Has {{count}} unread alerts",

  "online.group.loading": "Loading the group...",
  "online.group.badge": "Group",
  "online.group.season": "Season {{season}}",
  "online.group.seasonRange": "{{from}} – {{to}}",
  "online.group.seasonCurrent": "Running",
  "online.group.codeTitle": "Invite code",
  "online.group.codeHint": "Anyone with it can join the group.",
  "online.group.shareMessage":
    "Join my Hexy group \"{{name}}\" with the code {{code}}",
  "online.group.finishedTitle": "This season has ended",
  "online.group.finishedOwner":
    "The ranking is frozen. You can restart it whenever you want: points go back to zero, but your XP and level are untouched.",
  "online.group.finishedMember":
    "The ranking is frozen. Only {{owner}}, who created the group, can start a new season.",
  "online.group.chatStillOpen": "The chat stays open.",
  "online.group.renew": "Start season {{season}}",
  "online.group.renewed": "Season {{season}} is on.",
  "online.group.leaderboard": "Ranking",
  "online.group.leaderboardFrozen": "Final result",
  "online.group.leaderboardFrozenHint": "Frozen until the season is renewed.",
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
  "online.group.daily.attemptsOne": "1 attempt left",
  "online.group.daily.noAttempts": "You used both attempts",
  "online.group.daily.attemptsBoth": "You have two attempts",
  "online.group.daily.closesIn": "Closes in {{time}}",
  "online.group.daily.rule": "The better of your two attempts counts.",
  "online.group.daily.streakA11y":
    "Your streak: {{count}} days in a row, across all your groups",
  "online.group.chat.title": "Group chat",
  "online.group.chat.empty": "Nobody has written yet",
  "online.group.chat.unread": "Unread",
  "online.group.notice.seasonRenewed":
    "Season {{season}} is under way. The standings start from zero.",
  "online.group.notice.generic": "There is something new in this group.",
  "online.group.leave": "Leave group",
  "online.group.leaveOwnerHint":
    "If you leave, the group passes to the oldest member.",
  "online.group.edit": "Group settings",
  "online.group.settings.title": "Group settings",
  "online.group.settings.saveName": "Save name",
  "online.group.settings.renamed": "Name changed.",
  "online.group.settings.ownerOnly":
    "Only whoever created the group can change its name.",
  "online.group.settings.notifications": "Alerts from this group",
  "online.group.settings.notificationsHint":
    "Turns on the red dot when something happens here, like a new season. Off, the group stays quiet.",
  "online.group.settings.seasons": "Seasons",
  "online.group.settings.seasonsHint":
    "How many the group has played, and since when.",
  "online.group.settings.membersHint": "Points and days played this season.",
  "online.group.settings.addFriend": "Add {{name}} as a friend",
  "online.group.settings.shareCode": "Share the code",
  "online.group.settings.leaveHint": "You can join again with the code.",

  "online.chat.badge": "Chat",
  "online.chat.title": "Conversation",
  "online.chat.loading": "Loading the conversation...",
  "online.chat.loadingOlder": "Loading earlier messages...",
  "online.chat.emptyTitle": "Nobody has written here yet",
  "online.chat.emptyHint":
    "Write the first message. The whole group sees it.",
  "online.chat.placeholder": "Message the group",
  "online.chat.send": "Send the message",
  "online.chat.sending": "Sending",
  "online.chat.failed": "Not sent",
  "online.chat.retry": "Try again",
  "online.chat.discard": "Discard",
  "online.chat.stale":
    "New messages are not coming through. They will appear once the connection is back.",
  "online.chat.remaining": "{{count}} left",
  "online.chat.tooLong": "{{count}} too many",
  "online.chat.today": "Today",
  "online.chat.yesterday": "Yesterday",
  "online.chat.finishedHint": "Season over. The chat stays open.",
  "online.chat.preview": "{{name}}: {{body}}",
  "online.chat.previewMine": "You: {{body}}",
  "online.chat.messageA11y": "{{name}}, {{time}}: {{body}}",

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
  "online.daily.levelUp": "You reached level {{level}}.",
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
  "online.profile.friends": "Friends",
  "online.profile.friendsHint": "Your requests and your list.",
  "online.profile.friendsWaiting": "{{count}} waiting for an answer",
  "online.profile.friendsLoading": "Loading your friends...",
  "online.profile.friendsUnknown": "We could not find out who is waiting for you.",
  "online.profile.friendsNone": "No requests waiting.",
  "online.profile.friendsOpen": "See friends and search players",
  "online.profile.wantsToBeFriends": "Wants to be your friend",
  "online.profile.account": "Account details",
  "online.profile.memberSince": "Member since",
  "online.profile.nextLevel": "{{xp}} XP to reach level {{level}}.",
  "online.profile.dailyToday": "You earned {{xp}} XP today with the challenge.",
  "online.profile.dailyPlayed": "You already played today's challenge.",
  "online.profile.dailyPending": "Today's challenge hasn't given you XP yet.",
  "online.profile.streakA11y": "{{count}} days in a row playing the challenge",
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
  "online.friends.pendingOneA11y": "You have 1 friend request",
  "online.friends.pendingA11y": "You have {{count}} friend requests",
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

  "online.error.generic": "The server returned an unexpected error.",
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
  "common.exit": "Quitter",
  "common.next": "Suivant",
  "common.retry": "Réessayer",
  "common.share": "Partager",
  "common.loading": "Chargement du jeu...",
  "common.continue": "Continuer",
  "challenge.imageMissing": "Image indisponible",

  "a11y.back": "Revenir",
  "a11y.close": "Fermer",
  "a11y.stars": "{{value}} étoiles sur {{total}}",
  "a11y.rank": "Place {{position}}",
  "a11y.playersDecrease": "Retirer un joueur",
  "a11y.playersIncrease": "Ajouter un joueur",
  "a11y.wheel": "Roue de teinte et saturation",
  "a11y.brightness": "Luminosité",
  "a11y.selectedColor": "Couleur sélectionnée",

  "landing.badge": "Hexy",
  "landing.title": "Choisis comment\ntu veux jouer",
  "landing.subtitle":
    "Entraîne-toi en solo ou rassemble tes amis autour d'un même téléphone.",
  "landing.online.title": "En ligne",
  "landing.online.description": "Affronte d'autres joueurs en temps réel.",
  "landing.online.locked": "Nécessite une connexion · en développement",
  "landing.offline.title": "Hors ligne",
  "landing.offline.description":
    "Mode entraînement et parties de groupe sur cet appareil.",
  "landing.footer": "Le mode en ligne arrivera avec la prochaine mise à jour.",

  // --- Bienvenida y tutorial de la primera vez ---------------------------
  "welcome.greeting": "Bienvenue sur",
  "welcome.name": "Hexy",
  "welcome.cta": "Touche les cercles pour continuer",
  "welcome.continue": "Continuer",
  "tutorial.memorize": "Mémorise la couleur",
  "tutorial.findLabel": "Maintenant",
  "tutorial.findTitle": "Trouve-la",
  "tutorial.accuracy": "Précision",
  "tutorial.resultNote": "Ce qui compte, c’est à quel point tu t’approches.",
  "tutorial.next": "Suivant",
  "tutorial.check": "Vérifier",
  "tutorial.start": "Commencer",
  "tutorial.skip": "Passer",
  "tutorial.chipHole": "Trou",
  "tutorial.chipMine": "Toi",
  "tutorial.chipReal": "Vraie",
  "dev.tutorialTitle": "Tutoriel",
  "dev.tutorialHint": "Développement uniquement. Il partira avant la sortie.",
  "dev.tutorialButton": "Revoir le tutoriel",

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
    "🎨 Hexy — {{mode}}\nScore : {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Hexy — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} réussites ({{average}}%)\n{{stars}}",

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

  "settings.title": "Réglages",
  "settings.sound": "Son",
  "settings.music": "Musique",
  "settings.sfx": "Effets",
  "settings.language": "Langue",
  "settings.languageHint":
    "Celle de l'appareil est utilisée jusqu'à ce que tu en choisisses une autre. Le changement s'applique à la fermeture.",

  // --- Mode en ligne -----------------------------------------------------
  "online.session.restoring": "Restauration de ta session...",
  "online.level": "Niveau {{level}}",
  "online.xp": "{{xp}} XP",

  "online.auth.badge": "Mode en ligne",
  "online.auth.title": "Connexion",
  "online.auth.titleRegister": "Crée ton compte",
  "online.auth.subtitle":
    "Il te faut un compte pour jouer, avoir des amis et figurer au classement.",
  "online.auth.subtitleRegister":
    "Choisis un nom, garde ta progression et affronte les autres joueurs.",
  "online.auth.login": "Se connecter",
  "online.auth.register": "S'inscrire",
  "online.auth.username": "Pseudo",
  "online.auth.usernamePlaceholder": "coloriste",
  "online.auth.usernameHint":
    "De 3 à 24 caractères : lettres, chiffres et . _ - Tu pourras le changer.",
  "online.auth.email": "Email",
  "online.auth.emailPlaceholder": "toi@email.com",
  "online.auth.emailHint": "L'email utilisé à la création du compte.",
  "online.auth.password": "Mot de passe",
  "online.auth.passwordPlaceholder": "••••••••",
  "online.auth.passwordHint": "8 caractères minimum.",
  "online.auth.switchToRegister": "Pas encore de compte ?",
  "online.auth.switchToLogin": "Déjà un compte ?",
  "online.auth.offlineNote":
    "Le mode hors ligne fonctionne toujours sans compte ni connexion : tes records locaux ne bougent pas.",
  "online.auth.error.passwordRequired": "Saisis ton mot de passe.",
  "online.auth.error.passwordShort": "{{min}} caractères minimum.",
  "online.auth.error.usernameLength": "Entre 3 et 24 caractères.",
  "online.auth.error.usernameChars": "Uniquement lettres, chiffres et . _ -",
  "online.auth.error.email": "Cet email ne semble pas valide.",
  "online.auth.error.code": "Le code contient {{length}} chiffres.",
  "online.auth.or": "ou",
  "online.auth.google": "Continuer avec Google",
  "online.auth.apple": "Continuer avec Apple",
  "online.auth.connecting": "Connexion...",
  "online.auth.unavailable":
    "Le mode en ligne n'est pas configuré dans cette version. Le reste du jeu fonctionne normalement.",
  "online.auth.verify.title": "Confirme ton email",
  "online.auth.verify.subtitle":
    "Nous avons envoyé un code à 6 chiffres à {{email}}.",
  "online.auth.verify.code": "Code de vérification",
  "online.auth.verify.codePlaceholder": "123456",
  "online.auth.verify.hint": "Regarde aussi dans les spams.",
  "online.auth.verify.submit": "Confirmer",
  "online.auth.verify.resend": "Envoyer un autre code",
  "online.auth.verify.resent": "Code renvoyé.",
  "online.auth.verify.back": "Changer d'email",

  "online.hub.playSection": "Jouer",
  "online.hub.playHintDone":
    "Tu as joué le défi du jour dans tous tes groupes.",
  "online.hub.group.played": "Défi du jour joué · meilleur {{score}}",
  "online.hub.todayPoints": "Points du jour",

  "online.hub.dayLeft": "Il te reste {{count}} défis",
  "online.hub.dayLeftOne": "Il te reste 1 défi",
  "online.hub.dayDone": "Journée terminée",
  "online.hub.streakDays": "{{count}} jours d'affilée",
  "online.hub.streakToday": "Aujourd'hui compte déjà",
  "online.hub.streakPending": "Aujourd'hui ne compte pas encore",
  "online.hub.tileDone": "Défi terminé",
  "online.hub.tileClosed": "Fermé pour aujourd'hui",
  "online.hub.tileOpenHint": "Ouvre le groupe et son classement",
  "online.hub.quickCreate": "Créer un groupe",
  "online.hub.quickJoin": "J'ai un code",
  "online.hub.seeAllGroups": "Voir tous mes groupes",
  "online.hub.groupsEmpty": "Crée ton groupe et défie qui tu veux",
  "online.hub.groupsEmptyHint":
    "Chaque jour, un logo et une couleur à trouver. Tu joues seulement contre les gens que tu invites.",
  "online.hub.unranked": "—",

  "online.tabs.today": "Aujourd'hui",
  "online.tabs.groups": "Groupes",
  "online.tabs.ranking": "Classement",
  "online.tabs.profile": "Profil",

  "online.hub.queueDone": "Tout joué · {{total}} groupes",
  "online.hub.allDoneHint": "Tu as joué dans tous tes groupes. Le prochain défi ouvre à 15h00.",
  "online.hub.attempts": "Il te reste {{count}} essais",
  "online.hub.attemptsOne": "Il te reste 1 essai",
  "online.hub.streakSecured": "Série de {{count}} jours, assurée aujourd'hui",
  "online.hub.streakAtRisk": "Série de {{count}} jours. Tu n'as pas encore joué",

  "online.hub.loading": "Recherche de ce que tu dois jouer aujourd'hui...",

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
  "online.groups.unreadOneA11y": "A 1 alerte non lue",
  "online.groups.unreadA11y": "A {{count}} alertes non lues",

  "online.group.loading": "Chargement du groupe...",
  "online.group.badge": "Groupe",
  "online.group.season": "Saison {{season}}",
  "online.group.seasonRange": "{{from}} – {{to}}",
  "online.group.seasonCurrent": "En cours",
  "online.group.codeTitle": "Code d'invitation",
  "online.group.codeHint": "Qui l'a peut rejoindre le groupe.",
  "online.group.shareMessage":
    "Rejoins mon groupe Hexy « {{name}} » avec le code {{code}}",
  "online.group.finishedTitle": "Cette saison est terminée",
  "online.group.finishedOwner":
    "Le classement est figé. Tu peux le relancer quand tu veux : les points repartent à zéro, mais ton XP et ton niveau ne bougent pas.",
  "online.group.finishedMember":
    "Le classement est figé. Seul {{owner}}, qui a créé le groupe, peut lancer une nouvelle saison.",
  "online.group.chatStillOpen": "Le chat reste ouvert.",
  "online.group.renew": "Lancer la saison {{season}}",
  "online.group.renewed": "Saison {{season}} lancée.",
  "online.group.leaderboard": "Classement",
  "online.group.leaderboardFrozen": "Résultat final",
  "online.group.leaderboardFrozenHint":
    "Gelé jusqu'au renouvellement de la saison.",
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
  "online.group.daily.attemptsOne": "Il te reste 1 essai",
  "online.group.daily.noAttempts": "Tu as utilisé tes deux essais",
  "online.group.daily.attemptsBoth": "Tu as deux essais",
  "online.group.daily.closesIn": "Ferme dans {{time}}",
  "online.group.daily.rule": "Le meilleur de tes deux essais compte.",
  "online.group.daily.streakA11y":
    "Ta série : {{count}} jours d'affilée, tous groupes confondus",
  "online.group.chat.title": "Chat du groupe",
  "online.group.chat.empty": "Personne n'a encore écrit",
  "online.group.chat.unread": "Non lu",
  "online.group.notice.seasonRenewed":
    "La saison {{season}} est lancée. Le classement repart de zéro.",
  "online.group.notice.generic": "Il y a du nouveau dans ce groupe.",
  "online.group.leave": "Quitter le groupe",
  "online.group.leaveOwnerHint":
    "Si tu pars, le groupe passe au membre le plus ancien.",
  "online.group.edit": "Réglages du groupe",
  "online.group.settings.title": "Réglages du groupe",
  "online.group.settings.saveName": "Enregistrer le nom",
  "online.group.settings.renamed": "Nom modifié.",
  "online.group.settings.ownerOnly":
    "Seule la personne qui a créé le groupe peut en changer le nom.",
  "online.group.settings.notifications": "Alertes de ce groupe",
  "online.group.settings.notificationsHint":
    "Allume le point rouge quand il se passe quelque chose ici, une nouvelle saison par exemple. Éteint, le groupe ne te sollicite pas.",
  "online.group.settings.seasons": "Saisons",
  "online.group.settings.seasonsHint":
    "Combien le groupe en a jouées, et depuis quand.",
  "online.group.settings.membersHint": "Points et journées de cette saison.",
  "online.group.settings.addFriend": "Ajouter {{name}} en ami",
  "online.group.settings.shareCode": "Partager le code",
  "online.group.settings.leaveHint": "Tu peux revenir avec le code.",

  "online.chat.badge": "Chat",
  "online.chat.title": "Conversation",
  "online.chat.loading": "Chargement de la conversation...",
  "online.chat.loadingOlder": "Chargement des messages précédents...",
  "online.chat.emptyTitle": "Personne n'a encore écrit ici",
  "online.chat.emptyHint":
    "Écris le premier message. Tout le groupe le verra.",
  "online.chat.placeholder": "Écrire au groupe",
  "online.chat.send": "Envoyer le message",
  "online.chat.sending": "Envoi",
  "online.chat.failed": "Non envoyé",
  "online.chat.retry": "Réessayer",
  "online.chat.discard": "Supprimer",
  "online.chat.stale":
    "Les nouveaux messages n'arrivent pas. Ils apparaîtront au retour de la connexion.",
  "online.chat.remaining": "Il reste {{count}}",
  "online.chat.tooLong": "{{count}} de trop",
  "online.chat.today": "Aujourd'hui",
  "online.chat.yesterday": "Hier",
  "online.chat.finishedHint": "Saison terminée. Le chat reste ouvert.",
  "online.chat.preview": "{{name}} : {{body}}",
  "online.chat.previewMine": "Toi : {{body}}",
  "online.chat.messageA11y": "{{name}}, {{time}} : {{body}}",

  "online.daily.badge": "Défi du jour",
  "online.daily.title": "Le défi du jour",
  "online.daily.loading": "Chargement du défi du jour...",
  "online.daily.roundsTitle": "{{count}} images",
  "online.daily.roundsTitleOne": "1 image",
  "online.daily.roundsHint":
    "Les mêmes pour tout le monde. Elles changent chaque jour à 15h00.",
  "online.daily.statusOpen": "Ouvert",
  "online.daily.statusUsed": "Plus d'essais",
  "online.daily.statusClosed": "Fermé",
  "online.daily.attemptsLabel": "Essais",
  "online.daily.attemptsHint": "{{used}} sur 2 utilisés",
  "online.daily.bestLabel": "Ton meilleur",
  "online.daily.bestHint": "Points du jour",
  "online.daily.closesIn": "Se ferme dans",
  "online.daily.nextChallengeIn": "Prochain défi dans",
  "online.daily.cutHint":
    "Le défi change chaque jour à 15h00, heure de Madrid.",
  "online.daily.countdownDays": "{{days}} j {{hours}} h",
  "online.daily.countdownHours": "{{hours}} h {{minutes}} min",
  "online.daily.countdownMinutes": "{{minutes}} min {{seconds}} s",
  "online.daily.countdownSeconds": "{{seconds}} s",
  "online.daily.closedTitle": "Le défi est fermé",
  "online.daily.closedHint":
    "Une nouvelle journée a commencé. Recharge pour voir les logos du jour.",
  "online.daily.reload": "Recharger",
  "online.daily.noAttemptsTitle": "Tu as déjà joué aujourd'hui",
  "online.daily.noAttemptsHint":
    "Deux essais par journée. Reviens à l'ouverture du prochain défi.",
  "online.daily.noActiveGroups": "Ne compte dans aucun classement",
  "online.daily.countsOne": "Compte dans 1 classement",
  "online.daily.countsMany": "Compte dans {{count}} classements",
  "online.daily.noGroupTitle": "Ce défi appartient à un groupe",
  "online.daily.noGroupHint":
    "Chaque groupe a son propre défi quotidien, avec d'autres images. Rejoins-en un pour jouer.",
  "online.daily.countsIn": "Compte dans {{group}}",
  "online.daily.countsInHint":
    "Le score du jour compte uniquement dans le classement de ce groupe.",
  "online.daily.goToGroup": "Voir le classement",
  "online.daily.goToGroups": "Voir mes groupes",
  "online.daily.play": "Jouer le défi",
  "online.daily.playSecond": "Deuxième essai",
  "online.daily.check": "Vérifier",
  "online.daily.finish": "Envoyer l'essai",
  "online.daily.submitting": "Envoi de ton essai...",
  "online.daily.submitFailed": "Impossible d'envoyer l'essai",
  "online.daily.submitRetry": "Réessayer l'envoi",
  "online.daily.attemptLabel": "Essai",
  "online.daily.attemptValue": "{{number}} sur 2",
  "online.daily.resultTitle": "Résultat de l'essai",
  "online.daily.attemptPoints": "Points",
  "online.daily.position": "Place",
  "online.daily.positionHint": "Dans le défi du jour",
  "online.daily.bestIsThis": "C'est cet essai",
  "online.daily.xpEarned": "+{{xp}} XP",
  "online.daily.xpAlready": "L'XP du jour était déjà accordé",
  "online.daily.levelUp": "Tu passes au niveau {{level}}.",
  "online.daily.attemptsOneLeft": "Il te reste 1 essai",
  "online.daily.finishAttempt": "Terminer",
  "online.daily.roundPoints": "{{points}} pts",
  "online.daily.roundDetail": "Voir le détail de la manche {{round}}",
  "online.daily.roundImage": "Image {{round}}",
  "online.daily.missingAsset": "Logo indisponible",
  "online.daily.rulesTitle": "Comment ça marche",
  "online.daily.ruleAttempts": "Deux essais par journée ; le meilleur compte.",
  "online.daily.ruleBest":
    "Ton meilleur score du jour compte dans chaque groupe actif.",
  "online.daily.ruleServer":
    "La bonne couleur apparaît à la fin de l'essai : c'est le serveur qui vérifie.",

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
  "online.profile.subtitle": "Voilà comment les autres joueurs te voient.",
  "online.profile.friends": "Amis",
  "online.profile.friendsHint": "Tes demandes et ta liste.",
  "online.profile.friendsWaiting": "{{count}} en attente de réponse",
  "online.profile.friendsLoading": "Chargement de tes amis...",
  "online.profile.friendsUnknown": "Impossible de savoir qui t'attend.",
  "online.profile.friendsNone": "Aucune demande en attente.",
  "online.profile.friendsOpen": "Voir tes amis et chercher des joueurs",
  "online.profile.wantsToBeFriends": "Veut être ton ami",
  "online.profile.account": "Données du compte",
  "online.profile.memberSince": "Membre depuis",
  "online.profile.nextLevel": "Encore {{xp}} XP pour le niveau {{level}}.",
  "online.profile.dailyToday":
    "Tu as gagné {{xp}} XP aujourd'hui avec le défi.",
  "online.profile.dailyPlayed": "Tu as déjà joué le défi du jour.",
  "online.profile.dailyPending":
    "Le défi du jour ne t'a pas encore donné d'XP.",
  "online.profile.streakA11y": "{{count}} jours d'affilée à jouer le défi",
  "online.profile.edit": "Changer de nom",
  "online.profile.save": "Enregistrer",
  "online.profile.cancel": "Annuler",
  "online.profile.saved": "Nom mis à jour.",
  "online.profile.session": "Session",
  "online.profile.sessionHint":
    "La déconnexion efface la session de cet appareil. Le mode hors ligne n'est pas touché.",
  "online.profile.logout": "Se déconnecter",

  "online.friends.badge": "Amis",
  "online.friends.title": "Tes amis",
  "online.friends.subtitle": "Cherche des joueurs par leur nom et ajoute-les.",
  "online.friends.searchLabel": "Chercher des joueurs",
  "online.friends.searchPlaceholder": "Pseudo",
  "online.friends.searchHint": "Saisis au moins {{min}} caractères.",
  "online.friends.searching": "Recherche...",
  "online.friends.noResults": "Personne ne correspond à « {{query}} ».",
  "online.friends.add": "Ajouter",
  "online.friends.you": "C'est toi",
  "online.friends.alreadyFriend": "Déjà amis",
  "online.friends.requestSent": "Demande envoyée",
  "online.friends.requestReceived": "T'a écrit",
  "online.friends.incoming": "Demandes reçues",
  "online.friends.incomingHint":
    "Accepte pour apparaître dans vos classements d'amis.",
  "online.friends.outgoing": "Demandes envoyées",
  "online.friends.accept": "Accepter",
  "online.friends.pendingOneA11y": "Tu as 1 demande d'ami",
  "online.friends.pendingA11y": "Tu as {{count}} demandes d'ami",
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
  "online.leaderboard.subtitle": "Trié par XP cumulée.",
  "online.leaderboard.global": "Mondial",
  "online.leaderboard.friends": "Amis",
  "online.leaderboard.total": "{{total}} joueurs",
  "online.leaderboard.you": "toi",
  "online.leaderboard.loading": "Chargement du classement...",
  "online.leaderboard.loadMore": "Voir plus",
  "online.leaderboard.loadingMore": "Chargement...",
  "online.leaderboard.emptyGlobal": "Le classement est vide",
  "online.leaderboard.emptyGlobalHint": "Sois le premier à gagner de l'XP.",
  "online.leaderboard.emptyFriends": "Aucun ami au classement",
  "online.leaderboard.emptyFriendsHint":
    "Ajoute des amis et ils apparaîtront ici, triés par XP.",

  "online.error.generic": "Le serveur a renvoyé une erreur inattendue.",
  "online.error.network":
    "Impossible de joindre le serveur. Vérifie ta connexion.",
  "online.error.credentials": "Email ou mot de passe incorrect.",
  "online.error.passwordPwned":
    "Ce mot de passe apparaît dans des fuites connues. Choisis-en un autre.",
  "online.error.passwordWeak": "Ce mot de passe est trop faible.",
  "online.error.codeIncorrect": "Ce code n'est pas correct.",
  "online.error.codeExpired": "Le code a expiré. Demandes-en un nouveau.",
  "online.error.captcha": "Nous n'avons pas pu vérifier que tu es humain.",
  "online.error.sessionExists": "Tu es déjà connecté.",
  "online.error.emailUsed": "Un compte utilise déjà cet email.",
  "online.error.usernameUsed": "Ce pseudo est déjà pris.",
  "online.error.userNotFound": "Joueur introuvable.",
  "online.error.rateLimited": "Trop de tentatives. Patiente un instant.",
  "online.error.validation": "Vérifie les informations saisies.",
  "online.error.sessionExpired": "Ta session a expiré. Reconnecte-toi.",
  "online.error.friendExists": "Une demande existe déjà avec ce joueur.",
  "online.error.friendSelf": "Tu ne peux pas t'ajouter toi-même.",
  "online.error.friendNotFound": "Cette demande n'existe plus.",
  "online.error.dailyClosed":
    "Le défi que tu jouais est fermé. Recharge pour voir celui du jour.",
  "online.error.noAttemptsLeft": "Tu as déjà utilisé tes deux essais du jour.",
};

const ca: Record<TranslationKey, string> = {
  "common.back": "Inici",
  "common.exit": "Surt",
  "common.next": "Següent",
  "common.retry": "Reintenta",
  "common.share": "Comparteix",
  "common.loading": "Carregant el joc...",
  "common.continue": "Continua",
  "challenge.imageMissing": "Imatge no disponible",

  "a11y.back": "Torna",
  "a11y.close": "Tanca",
  "a11y.stars": "{{value}} de {{total}} estrelles",
  "a11y.rank": "Posició {{position}}",
  "a11y.playersDecrease": "Treu un jugador",
  "a11y.playersIncrease": "Afegeix un jugador",
  "a11y.wheel": "Roda de to i saturació",
  "a11y.brightness": "Brillantor",
  "a11y.selectedColor": "Color seleccionat",

  "landing.badge": "Hexy",
  "landing.title": "Tria com\nvols jugar",
  "landing.subtitle":
    "Practica sol o reuneix els teus amics al voltant d'un mateix mòbil.",
  "landing.online.title": "Online",
  "landing.online.description":
    "Competeix contra altres jugadors en temps real.",
  "landing.online.locked": "Necessita connexió a internet",
  "landing.offline.title": "Offline",
  "landing.offline.description":
    "Mode pràctica i partides en grup en aquest dispositiu.",
  "landing.footer":
    "L'offline funciona sense connexió; l'online necessita compte.",

  // --- Bienvenida y tutorial de la primera vez ---------------------------
  "welcome.greeting": "Et dono la benvinguda a",
  "welcome.name": "Hexy",
  "welcome.cta": "Fes clic als cercles per continuar",
  "welcome.continue": "Continua",
  "tutorial.memorize": "Memoritza el color",
  "tutorial.findLabel": "Ara",
  "tutorial.findTitle": "Troba’l",
  "tutorial.accuracy": "Precisió",
  "tutorial.resultNote": "Compta com t’hi acostes.",
  "tutorial.next": "Següent",
  "tutorial.check": "Comprova",
  "tutorial.start": "Comença",
  "tutorial.skip": "Salta",
  "tutorial.chipHole": "Buit",
  "tutorial.chipMine": "Teu",
  "tutorial.chipReal": "Real",
  "dev.tutorialTitle": "Tutorial",
  "dev.tutorialHint": "Només en desenvolupament. Marxara abans de publicar.",
  "dev.tutorialButton": "Torna a veure el tutorial",

  "offline.badge": "Mode offline",
  "offline.title": "Pràctica i grup",
  "offline.subtitle":
    "Juga tu sol o passeu-vos el mòbil entre diverses persones.",
  "offline.solo.section": "En solitari",
  "offline.solo.hint": "Modes de pràctica per a un jugador.",
  "offline.group.section": "En grup · mateix mòbil",
  "offline.group.hint": "Fins a 99 jugadors per torns.",

  "party.mode.battle.title": "Batalla d'endevinar",
  "party.mode.battle.description":
    "5 imatges per torns. Guanya qui més s'hi acosti.",
  "party.mode.battle-timed.title": "Batalla contrarellotge",
  "party.mode.battle-timed.description":
    "20 segons per jugador per sumar els màxims encerts.",
  "party.mode.coop.title": "Col·laboratiu",
  "party.mode.coop.description":
    "Sumeu les vostres puntuacions per a una nota comuna.",
  "party.mode.coop-timed.title": "Col·laboratiu contrarellotge",
  "party.mode.coop-timed.description":
    "20-30 s per jugador segons quants sigueu; sumeu-ho tot en equip.",

  "party.setup.title": "Configura la partida",
  "party.setup.playersLabel": "Nombre de jugadors",
  "party.setup.playersHint": "Entre {{min}} i {{max}} jugadors.",
  "party.setup.namesLabel": "Noms (opcional)",
  "party.setup.namesHint": "Deixa-ho en blanc per fer servir «Jugador N».",
  "party.setup.battleInfo": "{{count}} imatges iguals per a tothom.",
  "party.setup.coopInfo": "{{count}} imatges per jugador.",
  "party.setup.timedInfo": "{{seconds}} s per jugador.",
  "party.setup.start": "Comença la partida",

  "party.playerN": "Jugador {{n}}",

  "party.handoff.title": "Torn de {{name}}",
  "party.handoff.subtitle": "Passa el mòbil a aquest jugador.",
  "party.handoff.image": "Imatge {{current}} de {{total}}",
  "party.handoff.timed": "Tens {{seconds}} segons.",
  "party.handoff.start": "Estic a punt",

  "party.play.image": "Imatge {{current}} de {{total}}",
  "party.play.solved": "Encerts: {{count}}",
  "party.play.check": "Comprova",

  "party.guess.title": "Desat!",
  "party.guess.hidden": "Passa el mòbil sense mirar el color correcte.",

  "party.round.title": "Resultat de la imatge",
  "party.round.correct": "Color correcte",

  "party.final.title": "Classificació final",
  "party.final.coopTitle": "Resultat de l'equip",
  "party.final.winner": "Guanya {{name}}",
  "party.final.tie": "Empat!",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} encerts",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Mitjana de l'equip: {{average}}%",
  "party.final.teamRecord": "Millor mitjana de l'equip: {{average}}%",
  "party.final.teamRecordNew": "Nou rècord de l'equip!",
  "party.final.contributions": "Aportacions",
  "party.final.replay": "Torna a jugar",
  "party.final.home": "Torna als modes",

  "home.best": "Rècord: {{score}}",
  "home.bestAverage": "Rècord: {{average}}%",

  "mode.quick.title": "Joc ràpid",
  "mode.quick.description":
    "Endevina el color de cada repte i supera tots els nivells.",
  "mode.timed.title": "Contrarellotge",
  "mode.timed.description":
    "Encerta el màxim de colors abans que s'acabi el temps.",
  "mode.daily.title": "Repte diari",
  "mode.daily.description":
    "Un color nou cada dia per posar a prova el teu ull.",
  "mode.multicolor.title": "Multicolor",
  "mode.multicolor.description":
    "Reconstrueix tots els colors d'un mateix logotip, un a un.",

  "game.check": "Comprova",
  "game.empty.title": "No hi ha reptes disponibles.",
  "game.empty.subtitle":
    "Revisa el catàleg generat o les metadades dels reptes.",
  "game.colorStep": "Color {{current}} de {{total}}",
  "game.runLabel": "Partida",
  "game.hits": "Encerts: {{count}}",
  "game.points": "{{score}} pts",

  "progress.label": "Progrés",
  "progress.counter": "Repte {{current}} de {{total}}",

  "timer.label": "Temps",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Ratxa",
  "streak.value": "{{count}}",

  "result.kicker": "Resultat",
  "result.yours": "El teu color",
  "result.target": "Correcte",
  "result.deltaTitle": "Diferència",
  "result.hue": "To",
  "result.saturation": "Saturació",
  "result.value": "Brillantor",

  "summary.title": "Joc completat",
  "summary.total": "Puntuació total",
  "summary.average": "Mitjana",
  "summary.record": "Nou rècord!",
  "summary.best": "Millor: {{score}}",
  "summary.bestStreak": "Millor ratxa: {{count}}",
  "summary.points": "Punts",
  "summary.hits": "Encerts",
  "summary.hitsOf": "de {{rounds}} intents",
  "summary.home": "Torna a l'inici",
  "summary.shareText":
    "🎨 Hexy — {{mode}}\nPuntuació: {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Hexy — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} encerts ({{average}}%)\n{{stars}}",

  "daily.done.title": "Repte diari completat",
  "daily.done.subtitle": "Torna demà per a un color nou.",
  "daily.score": "El teu resultat d'avui: {{score}}%",

  "score.perfect": "Perfecte!",
  "score.close": "Molt a prop!",
  "score.good": "Bon intent",
  "score.tryAgain": "Continua provant",

  "run.artist": "Ull d'artista!",
  "run.great": "Quina punteria!",
  "run.good": "Bona feina",
  "run.practice": "Continua practicant",

  "validate.correct": "Correcte!",
  "validate.tryAgain": "Continua provant.",

  "settings.title": "Ajustos",
  "settings.sound": "So",
  "settings.music": "Música",
  "settings.sfx": "Efectes",
  "settings.language": "Idioma",
  "settings.languageHint":
    "S'usa el del dispositiu fins que en triïs un altre. El canvi s'aplica en tancar.",

  // --- Mode online -------------------------------------------------------
  "online.session.restoring": "Recuperant la teva sessió...",
  "online.level": "Nivell {{level}}",
  "online.xp": "{{xp}} XP",

  "online.auth.badge": "Mode online",
  "online.auth.title": "Entra al teu compte",
  "online.auth.titleRegister": "Crea el teu compte",
  "online.auth.subtitle":
    "Necessites un compte per competir, tenir amics i sortir a la classificació.",
  "online.auth.subtitleRegister":
    "Tria un nom, guarda el teu progrés i competeix amb la resta de jugadors.",
  "online.auth.login": "Inicia la sessió",
  "online.auth.register": "Registra't",
  "online.auth.username": "Nom de jugador",
  "online.auth.usernamePlaceholder": "colorista",
  "online.auth.usernameHint":
    "De 3 a 24 caràcters: lletres, números i . _ - El podràs canviar després.",
  "online.auth.email": "Email",
  "online.auth.emailPlaceholder": "tu@email.com",
  "online.auth.emailHint": "L'email amb què vas crear el compte.",
  "online.auth.password": "Contrasenya",
  "online.auth.passwordPlaceholder": "••••••••",
  "online.auth.passwordHint": "Mínim 8 caràcters.",
  "online.auth.switchToRegister": "Encara no tens compte?",
  "online.auth.switchToLogin": "Ja tens compte?",
  "online.auth.offlineNote":
    "El mode offline continua funcionant sense compte ni connexió: els teus rècords locals no es toquen.",
  "online.auth.error.passwordRequired": "Escriu la teva contrasenya.",
  "online.auth.error.passwordShort": "Mínim {{min}} caràcters.",
  "online.auth.error.usernameLength": "Entre 3 i 24 caràcters.",
  "online.auth.error.usernameChars": "Només lletres, números i . _ -",
  "online.auth.error.email": "Aquest email no sembla vàlid.",
  "online.auth.error.code": "El codi té {{length}} dígits.",
  "online.auth.or": "o",
  "online.auth.google": "Continua amb Google",
  "online.auth.apple": "Continua amb Apple",
  "online.auth.connecting": "Connectant...",
  "online.auth.unavailable":
    "El mode online no està configurat en aquesta versió de l'app. La resta del joc funciona igual.",
  "online.auth.verify.title": "Confirma el teu email",
  "online.auth.verify.subtitle":
    "T'hem enviat un codi de 6 dígits a {{email}}.",
  "online.auth.verify.code": "Codi de verificació",
  "online.auth.verify.codePlaceholder": "123456",
  "online.auth.verify.hint": "Mira també a la carpeta de correu brossa.",
  "online.auth.verify.submit": "Confirma",
  "online.auth.verify.resend": "Envia un altre codi",
  "online.auth.verify.resent": "Codi reenviat.",
  "online.auth.verify.back": "Canvia d'email",

  "online.hub.playSection": "Jugar",
  "online.hub.playHintDone":
    "Ja has jugat el repte d'avui a tots els teus grups.",
  "online.hub.group.played": "Repte d'avui jugat · millor {{score}}",
  "online.hub.todayPoints": "Punts d'avui",

  "online.hub.dayLeft": "Et queden {{count}} reptes",
  "online.hub.dayLeftOne": "Et queda 1 repte",
  "online.hub.dayDone": "Jornada completa",
  "online.hub.streakDays": "{{count}} dies seguits",
  "online.hub.streakToday": "Avui ja compta",
  "online.hub.streakPending": "Avui encara no compta",
  "online.hub.tileDone": "Repte fet",
  "online.hub.tileClosed": "Tancat per avui",
  "online.hub.tileOpenHint": "Obre el grup i la seva classificació",
  "online.hub.quickCreate": "Crea un grup",
  "online.hub.quickJoin": "Tinc un codi",
  "online.hub.seeAllGroups": "Mostra tots els meus grups",
  "online.hub.groupsEmpty": "Crea el teu grup i repta qui vulguis",
  "online.hub.groupsEmptyHint":
    "Cada dia, un logotip i un color per encertar. Competeixes només amb la gent que convidis.",
  "online.hub.unranked": "—",

  // --- Barra de pestanyes del mode online ---
  "online.tabs.today": "Avui",
  "online.tabs.groups": "Grups",
  "online.tabs.ranking": "Rànquing",
  "online.tabs.profile": "Perfil",

  // --- El repte d'avui, al menú ---
  "online.hub.queueDone": "Tot jugat · {{total}} grups",
  "online.hub.allDoneHint":
    "Ja has jugat a tots els teus grups. El repte següent obre a les 15:00.",
  "online.hub.attempts": "Et queden {{count}} intents",
  "online.hub.attemptsOne": "Et queda 1 intent",
  "online.hub.streakSecured": "Ratxa de {{count}} jornades, assegurada avui",
  "online.hub.streakAtRisk":
    "Ratxa de {{count}} jornades. Avui encara no has jugat",

  "online.hub.loading": "Buscant el que has de jugar avui...",

  "online.groups.badge": "Grups",
  "online.groups.title": "Els teus grups",
  "online.groups.subtitle":
    "Cada grup competeix 10 dies. Quan s'acaba, només el seu creador el pot reiniciar.",
  "online.groups.loading": "Carregant els teus grups...",
  "online.groups.emptyTitle": "Encara no ets a cap grup",
  "online.groups.emptyHint":
    "Crea'n un i convida els teus amics amb el codi, o entra amb el que t'hagin passat.",
  "online.groups.tabCreate": "Crear",
  "online.groups.tabJoin": "Unir-m'hi",
  "online.groups.nameLabel": "Nom del grup",
  "online.groups.namePlaceholder": "Els Pinzells",
  "online.groups.nameHint": "Entre 2 i 40 caràcters. El veuran els altres.",
  "online.groups.createSubmit": "Crea el grup",
  "online.groups.codeLabel": "Codi d'invitació",
  "online.groups.codePlaceholder": "K7QMBN",
  "online.groups.codeHint": "6 caràcters. Tant és majúscules com minúscules.",
  "online.groups.joinSubmit": "Entra al grup",
  "online.groups.created": "Grup creat. Comparteix el codi per convidar.",
  "online.groups.joined": "Ja hi ets a dins.",
  "online.groups.mine": "Els meus grups",
  "online.groups.members": "{{count}} membres",
  "online.groups.membersOne": "1 membre",
  "online.groups.statusActive": "Actiu",
  "online.groups.statusFinished": "Acabat",
  "online.groups.daysLeft": "Queden {{days}} dies",
  "online.groups.lastDay": "Últim dia",
  "online.groups.endsSoon": "Acaba avui",
  "online.groups.finishedHint": "Temporada {{season}} acabada",
  "online.groups.unread": "Novetats",
  "online.groups.unreadOneA11y": "Té 1 avís sense llegir",
  "online.groups.unreadA11y": "Té {{count}} avisos sense llegir",

  "online.group.loading": "Carregant el grup...",
  "online.group.badge": "Grup",
  "online.group.season": "Temporada {{season}}",
  "online.group.seasonRange": "{{from}} – {{to}}",
  "online.group.seasonCurrent": "En curs",
  "online.group.codeTitle": "Codi d'invitació",
  "online.group.codeHint": "Qui el tingui pot entrar al grup.",
  "online.group.shareMessage":
    "Entra al meu grup «{{name}}» de Hexy amb el codi {{code}}",
  "online.group.finishedTitle": "Aquesta temporada s'ha acabat",
  "online.group.finishedOwner":
    "La classificació queda congelada. La pots reiniciar quan vulguis: els punts tornen a zero, però el teu XP i el teu nivell no es toquen.",
  "online.group.finishedMember":
    "La classificació queda congelada. Només {{owner}}, que va crear el grup, pot començar una temporada nova.",
  "online.group.chatStillOpen": "El xat continua obert.",
  "online.group.renew": "Comença la temporada {{season}}",
  "online.group.renewed": "Temporada {{season}} en marxa.",
  "online.group.leaderboard": "Classificació",
  "online.group.leaderboardFrozen": "Resultat final",
  "online.group.leaderboardFrozenHint":
    "Congelada fins que es renovi la temporada.",
  "online.group.leaderboardHint": "Acumulat de la temporada.",
  "online.group.leaderboardEmpty": "Encara no hi ha jugat ningú",
  "online.group.leaderboardEmptyHint":
    "Les puntuacions del repte diari apareixen aquí tan bon punt algú jugui.",
  "online.group.points": "{{points}} pts",
  "online.group.daysPlayed": "{{days}} jornades",
  "online.group.dayPlayed": "1 jornada",
  "online.group.notPlayed": "Sense jugar",
  "online.group.you": "Tu",
  "online.group.owner": "Creador",
  "online.group.members": "Membres",
  "online.group.daily.title": "Repte d'avui",
  "online.group.daily.attemptsOne": "Et queda 1 intent",
  "online.group.daily.noAttempts": "Ja has fet servir els dos intents",
  "online.group.daily.attemptsBoth": "Tens dos intents",
  "online.group.daily.closesIn": "Tanca d'aquí a {{time}}",
  "online.group.daily.rule": "Compta el millor dels dos intents.",
  "online.group.daily.streakA11y":
    "La teva ratxa: {{count}} dies seguits jugant, a tots els teus grups",
  "online.group.chat.title": "Xat del grup",
  "online.group.chat.empty": "Encara no hi ha escrit ningú",
  "online.group.chat.unread": "Sense llegir",
  "online.group.notice.seasonRenewed":
    "La temporada {{season}} ja és en marxa. La classificació comença de zero.",
  "online.group.notice.generic": "Hi ha novetats en aquest grup.",
  "online.group.leave": "Surt del grup",
  "online.group.leaveOwnerHint":
    "Si te'n vas, el grup passa al membre més antic.",
  "online.group.edit": "Ajustos del grup",
  "online.group.settings.title": "Ajustos del grup",
  "online.group.settings.saveName": "Desa el nom",
  "online.group.settings.renamed": "Nom canviat.",
  "online.group.settings.ownerOnly":
    "Només qui va crear el grup en pot canviar el nom.",
  "online.group.settings.notifications": "Avisos d'aquest grup",
  "online.group.settings.notificationsHint":
    "Encén el punt vermell quan passa alguna cosa aquí, com una temporada nova. Apagat, el grup no et reclama l'atenció.",
  "online.group.settings.seasons": "Temporades",
  "online.group.settings.seasonsHint":
    "Quantes en porta el grup, i des de quan.",
  "online.group.settings.membersHint": "Punts i jornades d'aquesta temporada.",
  "online.group.settings.addFriend": "Afegeix {{name}} com a amic",
  "online.group.settings.shareCode": "Comparteix el codi",
  "online.group.settings.leaveHint": "Hi pots tornar a entrar amb el codi.",

  "online.chat.badge": "Xat",
  "online.chat.title": "Conversa",
  "online.chat.loading": "Carregant la conversa...",
  "online.chat.loadingOlder": "Portant el que hi havia abans...",
  "online.chat.emptyTitle": "Aquí no hi ha escrit ningú",
  "online.chat.emptyHint": "Escriu el primer missatge. El veurà tot el grup.",
  "online.chat.placeholder": "Escriu al grup",
  "online.chat.send": "Envia el missatge",
  "online.chat.sending": "Enviant",
  "online.chat.failed": "No s'ha enviat",
  "online.chat.retry": "Reintenta",
  "online.chat.discard": "Descarta",
  "online.chat.stale":
    "No arriba res nou. Apareixerà tan bon punt torni la connexió.",
  "online.chat.remaining": "En queden {{count}}",
  "online.chat.tooLong": "Te'n sobren {{count}}",
  "online.chat.today": "Avui",
  "online.chat.yesterday": "Ahir",
  "online.chat.finishedHint": "Temporada acabada. El xat continua obert.",
  "online.chat.preview": "{{name}}: {{body}}",
  "online.chat.previewMine": "Tu: {{body}}",
  "online.chat.messageA11y": "{{name}}, {{time}}: {{body}}",

  "online.daily.badge": "Repte diari",
  "online.daily.title": "El repte d'avui",
  "online.daily.loading": "Carregant el repte d'avui...",
  "online.daily.roundsTitle": "{{count}} imatges",
  "online.daily.roundsTitleOne": "1 imatge",
  "online.daily.roundsHint":
    "Les mateixes per a tothom. Canvien cada dia a les 15:00.",
  "online.daily.statusOpen": "Obert",
  "online.daily.statusUsed": "Sense intents",
  "online.daily.statusClosed": "Tancat",
  "online.daily.attemptsLabel": "Intents",
  "online.daily.attemptsHint": "{{used}} de 2 fets",
  "online.daily.bestLabel": "El teu millor",
  "online.daily.bestHint": "Punts d'avui",
  "online.daily.closesIn": "Es tanca d'aquí a",
  "online.daily.nextChallengeIn": "Pròxim repte d'aquí a",
  "online.daily.cutHint": "El repte canvia cada dia a les 15:00, hora de Madrid.",
  "online.daily.countdownDays": "{{days}} d {{hours}} h",
  "online.daily.countdownHours": "{{hours}} h {{minutes}} min",
  "online.daily.countdownMinutes": "{{minutes}} min {{seconds}} s",
  "online.daily.countdownSeconds": "{{seconds}} s",
  "online.daily.closedTitle": "El repte ha tancat",
  "online.daily.closedHint":
    "Ha començat una jornada nova. Torna a carregar per veure els logotips d'avui.",
  "online.daily.reload": "Torna a carregar",
  "online.daily.noAttemptsTitle": "Avui ja has jugat",
  "online.daily.noAttemptsHint":
    "Són dos intents per jornada. Torna quan obri el repte següent.",
  "online.daily.noActiveGroups": "No compta a cap classificació",
  "online.daily.countsOne": "Compta a 1 classificació",
  "online.daily.countsMany": "Compta a {{count}} classificacions",
  "online.daily.noGroupTitle": "Aquest repte és d'un grup",
  "online.daily.noGroupHint":
    "Cada grup té el seu propi repte diari, amb altres imatges. Entra en un per jugar.",
  "online.daily.countsIn": "Compta a {{group}}",
  "online.daily.countsInHint":
    "La puntuació d'avui només suma a la classificació d'aquest grup.",
  "online.daily.goToGroup": "Mostra la classificació",
  "online.daily.goToGroups": "Mostra els meus grups",
  "online.daily.play": "Juga el repte",
  "online.daily.playSecond": "Segon intent",
  "online.daily.check": "Comprova",
  "online.daily.finish": "Envia l'intent",
  "online.daily.submitting": "Enviant el teu intent...",
  "online.daily.submitFailed": "No s'ha pogut enviar l'intent",
  "online.daily.submitRetry": "Reintenta l'enviament",
  "online.daily.attemptLabel": "Intent",
  "online.daily.attemptValue": "{{number}} de 2",
  "online.daily.resultTitle": "Resultat de l'intent",
  "online.daily.attemptPoints": "Punts",
  "online.daily.position": "Posició",
  "online.daily.positionHint": "Al repte d'avui",
  "online.daily.bestIsThis": "És aquest intent",
  "online.daily.xpEarned": "+{{xp}} XP",
  "online.daily.xpAlready": "L'XP d'avui ja estava concedit",
  "online.daily.levelUp": "Has pujat al nivell {{level}}.",
  "online.daily.attemptsOneLeft": "Et queda 1 intent",
  "online.daily.finishAttempt": "Acaba",
  "online.daily.roundPoints": "{{points}} pts",
  "online.daily.roundDetail": "Mostra el detall de la ronda {{round}}",
  "online.daily.roundImage": "Imatge {{round}}",
  "online.daily.missingAsset": "Logotip no disponible",
  "online.daily.rulesTitle": "Com funciona",
  "online.daily.ruleAttempts": "Dos intents per jornada; compta el millor.",
  "online.daily.ruleBest":
    "La teva millor puntuació del dia suma a cada grup actiu.",
  "online.daily.ruleServer":
    "El color correcte apareix en tancar l'intent: ho comprova el servidor.",

  "online.dev.title": "Viatge en el temps",
  "online.dev.hint":
    "Només en desenvolupament. El desfasament es perd en reiniciar el backend.",
  "online.dev.day": "+1 dia",
  "online.dev.tenDays": "+10 dies",
  "online.dev.endSeason": "Acaba aquesta temporada",
  "online.dev.reset": "Torna al temps real",
  "online.dev.offset": "Desfasament: {{days}} d {{hours}} h",
  "online.dev.realTime": "En temps real",

  "online.error.groupNotFound": "Aquest grup no existeix o ja no hi ets.",
  "online.error.groupCodeInvalid": "Aquest codi no existeix.",
  "online.error.alreadyMember": "Ja ets en aquest grup.",
  "online.error.notGroupOwner": "Només qui va crear el grup pot fer això.",
  "online.error.seasonStillActive":
    "La temporada continua en marxa: encara no es pot reiniciar.",

  "online.profile.badge": "Perfil",
  "online.profile.title": "El teu perfil",
  "online.profile.subtitle": "Així et veu la resta de jugadors.",
  "online.profile.friends": "Amics",
  "online.profile.friendsHint": "Les teves sol·licituds i la teva llista.",
  "online.profile.friendsWaiting": "{{count}} esperant resposta",
  "online.profile.friendsLoading": "Carregant els teus amics...",
  "online.profile.friendsUnknown": "No hem pogut saber qui t'espera.",
  "online.profile.friendsNone": "No tens cap sol·licitud pendent.",
  "online.profile.friendsOpen": "Mostra els amics i busca jugadors",
  "online.profile.wantsToBeFriends": "Vol ser el teu amic",
  "online.profile.account": "Dades del compte",
  "online.profile.memberSince": "Membre des de",
  "online.profile.nextLevel": "Falten {{xp}} XP per al nivell {{level}}.",
  "online.profile.dailyToday": "Avui has guanyat {{xp}} XP amb el repte.",
  "online.profile.dailyPlayed": "Avui ja has jugat el repte.",
  "online.profile.dailyPending": "El repte d'avui encara no t'ha donat XP.",
  "online.profile.streakA11y": "{{count}} dies seguits jugant el repte",
  "online.profile.edit": "Canvia el nom",
  "online.profile.save": "Desa",
  "online.profile.cancel": "Cancel·la",
  "online.profile.saved": "Nom actualitzat.",
  "online.profile.session": "Sessió",
  "online.profile.sessionHint":
    "En sortir s'esborra la sessió d'aquest dispositiu. El mode offline no es veu afectat.",
  "online.profile.logout": "Tanca la sessió",

  "online.friends.badge": "Amics",
  "online.friends.title": "Els teus amics",
  "online.friends.subtitle": "Busca jugadors pel seu nom i afegeix-los.",
  "online.friends.searchLabel": "Busca jugadors",
  "online.friends.searchPlaceholder": "Nom d'usuari",
  "online.friends.searchHint": "Escriu com a mínim {{min}} caràcters.",
  "online.friends.searching": "Buscant...",
  "online.friends.noResults": "No hi ha ningú que coincideixi amb «{{query}}».",
  "online.friends.add": "Afegeix",
  "online.friends.you": "Ets tu",
  "online.friends.alreadyFriend": "Ja sou amics",
  "online.friends.requestSent": "Sol·licitud enviada",
  "online.friends.requestReceived": "T'ha escrit",
  "online.friends.incoming": "Sol·licituds rebudes",
  "online.friends.incomingHint":
    "Accepta-la per veure-us a la classificació d'amics.",
  "online.friends.outgoing": "Sol·licituds enviades",
  "online.friends.accept": "Accepta",
  "online.friends.pendingOneA11y": "Tens 1 sol·licitud d'amistat",
  "online.friends.pendingA11y": "Tens {{count}} sol·licituds d'amistat",
  "online.friends.reject": "Rebutja",
  "online.friends.cancel": "Cancel·la",
  "online.friends.remove": "Elimina",
  "online.friends.list": "Amics",
  "online.friends.listCount": "{{count}} en total.",
  "online.friends.loading": "Carregant els amics...",
  "online.friends.emptyTitle": "Encara no tens amics",
  "online.friends.emptyHint":
    "Busca algú pel seu nom d'usuari i envia-li una sol·licitud.",

  "online.leaderboard.badge": "Classificació",
  "online.leaderboard.title": "Rànquing",
  "online.leaderboard.subtitle": "S'ordena per XP acumulat.",
  "online.leaderboard.global": "Mundial",
  "online.leaderboard.friends": "Amics",
  "online.leaderboard.total": "{{total}} jugadors",
  "online.leaderboard.you": "tu",
  "online.leaderboard.loading": "Carregant la classificació...",
  "online.leaderboard.loadMore": "Mostra'n més",
  "online.leaderboard.loadingMore": "Carregant...",
  "online.leaderboard.emptyGlobal": "La classificació és buida",
  "online.leaderboard.emptyGlobalHint": "Sigues el primer a sumar XP.",
  "online.leaderboard.emptyFriends": "Cap amic a la classificació",
  "online.leaderboard.emptyFriendsHint":
    "Afegeix amics i apareixeran aquí ordenats per XP.",

  "online.error.generic": "El servidor ha respost amb un error inesperat.",
  "online.error.network":
    "No hem pogut connectar amb el servidor. Revisa la teva connexió.",
  "online.error.credentials": "Email o contrasenya incorrectes.",
  "online.error.passwordPwned":
    "Aquesta contrasenya ha aparegut en filtracions conegudes. Tria'n una altra.",
  "online.error.passwordWeak": "Aquesta contrasenya és massa feble.",
  "online.error.codeIncorrect": "Aquest codi no és correcte.",
  "online.error.codeExpired": "El codi ha caducat. Demana'n un de nou.",
  "online.error.captcha": "No hem pogut verificar que ets una persona.",
  "online.error.sessionExists": "Ja tens la sessió oberta.",
  "online.error.emailUsed": "Ja hi ha un compte amb aquest email.",
  "online.error.usernameUsed": "Aquest nom d'usuari ja està agafat.",
  "online.error.userNotFound": "No hem trobat aquest jugador.",
  "online.error.rateLimited": "Massa intents. Espera un moment.",
  "online.error.validation": "Revisa les dades introduïdes.",
  "online.error.sessionExpired": "La teva sessió ha caducat. Torna a entrar.",
  "online.error.friendExists": "Ja hi ha una sol·licitud amb aquest jugador.",
  "online.error.friendSelf": "No et pots afegir a tu mateix.",
  "online.error.friendNotFound": "Aquesta sol·licitud ja no existeix.",
  "online.error.dailyClosed":
    "El repte que estaves jugant ha tancat. Torna a carregar per veure el d'avui.",
  "online.error.noAttemptsLeft": "Ja has fet servir els dos intents d'avui.",
};

export type Locale = "es" | "en" | "fr" | "ca";

const resources: Record<Locale, Partial<Record<TranslationKey, string>>> = {
  es,
  en,
  fr,
  ca,
};

/**
 * Los idiomas del selector de ajustes, **cada uno escrito en sí mismo**.
 *
 * «Français» y no «Francés»: quien busca su idioma en una lista lo busca con la
 * palabra que conoce, y esa palabra está justamente en el idioma que todavía no
 * puede leer. Traducir esta lista la volvería inútil para el único caso que
 * importa —abrir la app en un idioma que no entiendes y salir de ahí—, así que
 * estas cuatro cadenas son las únicas de todo el fichero que no pasan por `t()`.
 *
 * El orden es el de la lista de arriba y no el alfabético de ningún idioma
 * concreto: alfabetizar obligaría a reordenar según el idioma activo, y ver los
 * botones cambiar de sitio al elegir es peor que no tenerlos ordenados.
 */
export const LOCALES: readonly { code: Locale; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ca", label: "Català" },
];

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && Object.hasOwn(resources, value);
}

function detectLocale(): Locale {
  try {
    const [primary] = getLocales();
    const tag = primary?.languageCode;
    return isLocale(tag) ? tag : "es";
  } catch {
    return "es";
  }
}

/**
 * El idioma del teléfono, resuelto una sola vez al cargar el módulo.
 *
 * Es el valor de partida: mientras el jugador no elija otro en los ajustes, la
 * app va en el idioma del dispositivo, que es como se ha comportado siempre.
 * `_layout.tsx` lo pisa con la preferencia guardada —si la hay— antes del primer
 * pintado.
 */
const activeLocaleDefault = detectLocale();

let activeLocale: Locale = activeLocaleDefault;

/**
 * Quién quiere enterarse de un cambio de idioma.
 *
 * `t()` es una función de módulo, no un gancho: nadie se entera de que
 * `activeLocale` ha cambiado, y React no repinta por su cuenta lo que ya está en
 * pantalla. Este conjunto es lo que convierte el cambio en algo observable, y
 * `useLocale()` es la forma de observarlo desde un componente.
 */
const listeners = new Set<() => void>();

export function setLocale(locale: Locale): void {
  if (!isLocale(locale) || locale === activeLocale) {
    return;
  }

  activeLocale = locale;
  for (const listener of listeners) {
    listener();
  }
}

export function getLocale(): Locale {
  return activeLocale;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * El idioma activo, como estado de React.
 *
 * `useSyncExternalStore` y no un `useState` global: la fuente de verdad es
 * `activeLocale`, que existe fuera de React porque `t()` se llama también desde
 * sitios que no son componentes.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
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
