import type { Locale } from "@/i18n";

/**
 * Los textos legales: privacidad y términos de uso.
 *
 * ## Por qué viven fuera del diccionario
 *
 * El diccionario de `i18n/index.ts` son frases sueltas con clave; esto son dos
 * documentos con secciones y párrafos. Meterlos allí obligaría a inventar
 * cuatrocientas claves numeradas —`legal.privacy.block3.p2`— que nadie puede
 * leer ni reordenar sin contarlas. Aquí la forma del documento **es** la
 * estructura del dato, así que añadir un párrafo es añadir una línea.
 *
 * ## Tienen que decir lo mismo que la web
 *
 * Las mismas páginas están en `web-colors/src/legal/`, y son las que se
 * declaran en las fichas de las tiendas. Si cambia una, cambia la otra: dos
 * versiones distintas de la misma política es peor que no tener ninguna.
 */

/** Un apartado del documento: su título y sus párrafos. */
export interface LegalBlock {
  title: string;
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  /** La entradilla, antes del primer apartado. */
  lead: string;
  blocks: LegalBlock[];
}

/**
 * Correo de contacto, el mismo que la web.
 *
 * **Es un marcador**: tiene que existir de verdad antes de publicar, porque es
 * la dirección por la que se piden las bajas y se ejercen los derechos del
 * RGPD. Ver `web-colors/src/legal/LegalLayout.tsx`, que tiene la otra copia.
 */
export const SOPORTE = "hola@karakuristudios.com";

/** El responsable del tratamiento. También marcador, y también obligatorio. */
const RESPONSABLE = "[nombre o razón social]";
const RESPONSABLE_ID = "[NIF/CIF]";

const es: { privacy: LegalDoc; terms: LegalDoc } = {
  privacy: {
    title: "Privacidad",
    lead: "Iromi guarda lo justo para que el juego funcione: quién eres, con quién juegas y qué has acertado. No hay publicidad ni rastreadores, y tus datos no se venden.",
    blocks: [
      {
        title: "Quién responde",
        paragraphs: [
          `El responsable del tratamiento es ${RESPONSABLE}, con ${RESPONSABLE_ID}. Para cualquier cosa relacionada con tus datos, escribe a ${SOPORTE}.`,
        ],
      },
      {
        title: "Qué se guarda y para qué",
        paragraphs: [
          "Hay tres grupos de datos.",
          "Tu cuenta: el correo y el nombre de usuario con los que entras. Sin ellos no hay forma de reconocerte al volver ni de que tus amigos te encuentren.",
          "Tu juego: la experiencia, el nivel, las puntuaciones de cada jornada, los grupos a los que perteneces y los mensajes que escribes en sus chats.",
          "Tus avisos: si activas las notificaciones, se guarda el identificador que tu teléfono usa para recibirlas.",
          "No se recoge nada más: ni tu ubicación, ni tu agenda, ni qué otras aplicaciones tienes. No hay analítica ni rastreo publicitario.",
        ],
      },
      {
        title: "Lo que no sale de tu teléfono",
        paragraphs: [
          "Las partidas del Taller, tus récords de los modos en solitario, el idioma y si juegas en claro u oscuro se guardan solo en tu dispositivo. No viajan a ningún servidor.",
        ],
      },
      {
        title: "Con qué derecho",
        paragraphs: [
          "Para lo de la cuenta y el juego, porque hace falta para prestarte el servicio que has pedido (artículo 6.1.b del RGPD). Para las notificaciones, porque tú las activas y puedes desactivarlas cuando quieras (artículo 6.1.a).",
        ],
      },
      {
        title: "Quién más los ve",
        paragraphs: [
          "Nadie compra ni vende estos datos. Iromi se apoya en cuatro proveedores, cada uno para una sola cosa:",
          "Clerk guarda las credenciales y verifica quién eres al entrar. Iromi nunca ve tu contraseña.",
          "Neon es la base de datos donde viven los grupos, las puntuaciones y los mensajes.",
          "Fly.io son los servidores donde corre el juego.",
          "Expo entrega las notificaciones a tu teléfono.",
          "Algunos están fuera de la Unión Europea. En esos casos la transferencia se ampara en las cláusulas contractuales tipo aprobadas por la Comisión Europea.",
        ],
      },
      {
        title: "Cuánto tiempo",
        paragraphs: [
          "Mientras tengas cuenta. Cuando la eliminas, se borran tu nombre, tu correo, tus credenciales, tu experiencia, tus amistades y tus avisos.",
          "Se conservan, sin tu nombre, los mensajes que escribiste en los chats de tus grupos y tus puntuaciones de temporadas ya cerradas: son parte de conversaciones y clasificaciones de otras personas. Aparecen como «Cuenta eliminada».",
        ],
      },
      {
        title: "Qué puedes exigir",
        paragraphs: [
          "Acceder a tus datos, corregirlos, borrarlos, llevártelos a otro sitio, limitar su uso u oponerte a él. El borrado lo puedes hacer tú mismo desde Perfil, en cualquier momento.",
          `Para lo demás, escribe a ${SOPORTE} y se responde en un plazo máximo de un mes. Si crees que no se ha hecho bien, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).`,
        ],
      },
      {
        title: "Menores",
        paragraphs: [
          "Iromi no está dirigido a menores de 14 años, que es la edad a partir de la cual la ley española permite consentir el tratamiento de los propios datos.",
        ],
      },
      {
        title: "Si esto cambia",
        paragraphs: [
          "Se actualiza esta pantalla. Si el cambio afecta a algo importante, como un dato nuevo o un proveedor nuevo, se avisa dentro de la aplicación antes de que entre en vigor.",
        ],
      },
    ],
  },
  terms: {
    title: "Términos de uso",
    lead: "Estas son las reglas de Iromi, y al crear una cuenta las aceptas. Caben en una pantalla.",
    blocks: [
      {
        title: "Qué es Iromi",
        paragraphs: [
          `Un juego de color. Cada día a las 15:00 aparecen cinco imágenes con un color quitado y tienes dos intentos para acertar cuál era; el Taller funciona sin conexión y sin cuenta. Lo ofrece ${RESPONSABLE}.`,
        ],
      },
      {
        title: "Tu cuenta",
        paragraphs: [
          "Hace falta una para jugar en grupo. Tienes que tener al menos 14 años, dar un correo que sea tuyo y no suplantar a nadie con el nombre de usuario. Eres responsable de lo que se haga desde tu cuenta.",
          "Puedes eliminarla cuando quieras desde Perfil, sin dar explicaciones.",
        ],
      },
      {
        title: "Cómo se juega con los demás",
        paragraphs: [
          "Los grupos tienen chat, y ahí escriben personas. No se permite insultar, acosar, amenazar, publicar datos de otros ni colar publicidad. Tampoco trampear las clasificaciones con cuentas falsas o herramientas automáticas.",
          "Lo que escribes en un chat lo ven los miembros de ese grupo. Iromi no revisa los mensajes uno a uno, pero sí puede retirar contenido y cerrar cuentas cuando alguien avisa de un abuso.",
        ],
      },
      {
        title: "Un proyecto independiente",
        paragraphs: [
          "Iromi es un proyecto independiente. No está afiliado, asociado ni patrocinado por ninguna de las marcas cuyos logotipos aparecen en el juego, ni mantiene relación con ellas.",
          "Los logotipos se usan para identificar la marca dentro de una prueba de color, como un juego de preguntas menciona el título de una película. Siguen siendo de sus dueños.",
        ],
      },
      {
        title: "Nadie gana dinero con esto",
        paragraphs: [
          "Iromi es gratis. No hay publicidad, ni compras dentro de la aplicación, ni suscripciones: las marcas no generan aquí ningún ingreso. El juego no se presenta como producto oficial de nadie.",
        ],
      },
      {
        title: "Si eres titular de una marca",
        paragraphs: [
          `Escribe a ${SOPORTE} indicando a quién representas y se retira del catálogo. No hace falta dar más motivos.`,
        ],
      },
      {
        title: "Qué se puede esperar del servicio",
        paragraphs: [
          "Iromi se ofrece tal cual. Se intenta que esté siempre disponible, pero no se garantiza que no falle ni que no haya que pararlo para mantenimiento, y los retos, los modos y las reglas pueden cambiar.",
        ],
      },
      {
        title: "Si incumples esto",
        paragraphs: [
          `Una cuenta que acosa, suplanta o trampea puede suspenderse o cerrarse. Si crees que ha sido un error, escribe a ${SOPORTE}.`,
        ],
      },
      {
        title: "Responsabilidad",
        paragraphs: [
          "Iromi responde de los daños que cause por dolo o negligencia grave, en los términos de la ley. No responde del contenido que escriban otros usuarios en los chats, ni de fallos de la red o del dispositivo desde el que juegas.",
          "Nada de esto limita los derechos que te reconoce la normativa de consumidores, que siempre prevalece.",
        ],
      },
      {
        title: "Qué ley se aplica",
        paragraphs: [
          "La española. Si hay una discusión que no se pueda resolver hablando, serán competentes los juzgados del domicilio del consumidor.",
        ],
      },
    ],
  },
};

const en: typeof es = {
  privacy: {
    title: "Privacy",
    lead: "Iromi stores only what the game needs: who you are, who you play with and what you got right. No ads, no trackers, and your data is not sold.",
    blocks: [
      {
        title: "Who is responsible",
        paragraphs: [
          `The data controller is ${RESPONSABLE}, ${RESPONSABLE_ID}. For anything about your data, write to ${SOPORTE}.`,
        ],
      },
      {
        title: "What is stored, and why",
        paragraphs: [
          "There are three groups of data.",
          "Your account: the email and username you sign in with. Without them there is no way to recognise you when you come back, or for your friends to find you.",
          "Your game: experience, level, each day's scores, the groups you belong to and the messages you write in their chats.",
          "Your alerts: if you turn on notifications, the identifier your phone uses to receive them.",
          "Nothing else is collected: not your location, not your contacts, not which other apps you have. There is no analytics and no ad tracking.",
        ],
      },
      {
        title: "What never leaves your phone",
        paragraphs: [
          "Studio games, your solo records, the language and whether you play in light or dark mode are stored only on your device. They never reach a server.",
        ],
      },
      {
        title: "On what legal basis",
        paragraphs: [
          "For the account and the game, because it is needed to provide the service you asked for (GDPR article 6.1.b). For notifications, because you turn them on and can turn them off whenever you want (article 6.1.a).",
        ],
      },
      {
        title: "Who else sees it",
        paragraphs: [
          "Nobody buys or sells this data. Iromi relies on four providers, each for one thing only:",
          "Clerk stores the credentials and verifies who you are when you sign in. Iromi never sees your password.",
          "Neon is the database where groups, scores and messages live.",
          "Fly.io are the servers the game runs on.",
          "Expo delivers notifications to your phone.",
          "Some are outside the European Union. Those transfers rely on the standard contractual clauses approved by the European Commission.",
        ],
      },
      {
        title: "For how long",
        paragraphs: [
          "As long as you have an account. When you delete it, your name, email, credentials, experience, friendships and alerts are erased.",
          "What stays, without your name, are the messages you wrote in your groups' chats and your scores from closed seasons: they are part of other people's conversations and standings. They show as “Deleted account”.",
        ],
      },
      {
        title: "What you can demand",
        paragraphs: [
          "Access your data, correct it, erase it, take it elsewhere, restrict its use or object to it. You can delete it yourself from Profile, at any time.",
          `For anything else, write to ${SOPORTE} and you will get an answer within one month. If you think it was handled badly, you can complain to the Spanish Data Protection Agency (aepd.es).`,
        ],
      },
      {
        title: "Minors",
        paragraphs: [
          "Iromi is not aimed at children under 14, the age from which Spanish law allows consenting to the processing of one's own data.",
        ],
      },
      {
        title: "If this changes",
        paragraphs: [
          "This screen is updated. If the change affects something important, such as a new kind of data or a new provider, you are told inside the app before it takes effect.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of use",
    lead: "These are Iromi's rules, and you accept them when you create an account. They fit on one screen.",
    blocks: [
      {
        title: "What Iromi is",
        paragraphs: [
          `A colour game. Every day at 15:00 five images appear with a colour removed and you get two attempts to guess which one it was; the Studio works offline and without an account. It is offered by ${RESPONSABLE}.`,
        ],
      },
      {
        title: "Your account",
        paragraphs: [
          "You need one to play in a group. You must be at least 14, give an email that is yours and not impersonate anyone with your username. You are responsible for what is done from your account.",
          "You can delete it whenever you want from Profile, without giving reasons.",
        ],
      },
      {
        title: "Playing with others",
        paragraphs: [
          "Groups have a chat, and people write in it. Insulting, harassing, threatening, posting other people's data or slipping in advertising is not allowed. Neither is gaming the standings with fake accounts or automated tools.",
          "What you write in a chat is seen by that group's members. Iromi does not review messages one by one, but it can remove content and close accounts when someone reports abuse.",
        ],
      },
      {
        title: "An independent project",
        paragraphs: [
          "Iromi is an independent project. It is not affiliated with, associated with or sponsored by any of the brands whose logos appear in the game.",
          "The logos are used to identify the brand within a colour puzzle, the way a quiz game mentions the title of a film. They remain their owners'.",
        ],
      },
      {
        title: "Nobody makes money from this",
        paragraphs: [
          "Iromi is free. There are no ads, no in-app purchases and no subscriptions: the brands generate no income here. The game is not presented as anyone's official product.",
        ],
      },
      {
        title: "If you own a brand",
        paragraphs: [
          `Write to ${SOPORTE} saying who you represent and it is removed from the catalogue. No further reasons needed.`,
        ],
      },
      {
        title: "What to expect from the service",
        paragraphs: [
          "Iromi is offered as is. We try to keep it always available, but we cannot guarantee it will not fail or that it will not be stopped for maintenance, and the challenges, modes and rules may change.",
        ],
      },
      {
        title: "If you break these rules",
        paragraphs: [
          `An account that harasses, impersonates or cheats can be suspended or closed. If you think it was a mistake, write to ${SOPORTE}.`,
        ],
      },
      {
        title: "Liability",
        paragraphs: [
          "Iromi is liable for damage it causes through wilful misconduct or gross negligence, as the law provides. It is not liable for what other users write in chats, nor for failures of the network or of the device you play on.",
          "None of this limits the rights consumer law gives you, which always prevail.",
        ],
      },
      {
        title: "Which law applies",
        paragraphs: [
          "Spanish law. If there is a dispute that cannot be settled by talking, the courts of the consumer's domicile have jurisdiction.",
        ],
      },
    ],
  },
};

const fr: typeof es = {
  privacy: {
    title: "Confidentialité",
    lead: "Iromi ne garde que ce qu'il faut pour que le jeu fonctionne : qui tu es, avec qui tu joues et ce que tu as trouvé. Pas de publicité, pas de traceurs, et tes données ne sont pas vendues.",
    blocks: [
      {
        title: "Qui est responsable",
        paragraphs: [
          `Le responsable du traitement est ${RESPONSABLE}, ${RESPONSABLE_ID}. Pour tout ce qui concerne tes données, écris à ${SOPORTE}.`,
        ],
      },
      {
        title: "Ce qui est conservé, et pourquoi",
        paragraphs: [
          "Il y a trois groupes de données.",
          "Ton compte : l'e-mail et le nom d'utilisateur avec lesquels tu te connectes. Sans eux, impossible de te reconnaître à ton retour ni que tes amis te trouvent.",
          "Ton jeu : l'expérience, le niveau, les scores de chaque journée, les groupes dont tu fais partie et les messages que tu écris dans leurs discussions.",
          "Tes alertes : si tu actives les notifications, l'identifiant que ton téléphone utilise pour les recevoir.",
          "Rien d'autre n'est collecté : ni ta position, ni ton carnet d'adresses, ni les autres applications que tu as. Il n'y a ni analytique ni pistage publicitaire.",
        ],
      },
      {
        title: "Ce qui ne quitte pas ton téléphone",
        paragraphs: [
          "Les parties de l'Atelier, tes records en solo, la langue et le mode clair ou sombre restent uniquement sur ton appareil. Rien ne part vers un serveur.",
        ],
      },
      {
        title: "Sur quelle base légale",
        paragraphs: [
          "Pour le compte et le jeu, parce que c'est nécessaire pour fournir le service que tu as demandé (article 6.1.b du RGPD). Pour les notifications, parce que tu les actives et peux les désactiver quand tu veux (article 6.1.a).",
        ],
      },
      {
        title: "Qui d'autre les voit",
        paragraphs: [
          "Personne n'achète ni ne vend ces données. Iromi s'appuie sur quatre prestataires, chacun pour une seule chose :",
          "Clerk conserve les identifiants et vérifie qui tu es à la connexion. Iromi ne voit jamais ton mot de passe.",
          "Neon est la base de données où vivent les groupes, les scores et les messages.",
          "Fly.io, ce sont les serveurs sur lesquels tourne le jeu.",
          "Expo distribue les notifications à ton téléphone.",
          "Certains sont hors de l'Union européenne. Ces transferts s'appuient sur les clauses contractuelles types approuvées par la Commission européenne.",
        ],
      },
      {
        title: "Pendant combien de temps",
        paragraphs: [
          "Tant que tu as un compte. Quand tu le supprimes, ton nom, ton e-mail, tes identifiants, ton expérience, tes amitiés et tes alertes sont effacés.",
          "Restent, sans ton nom, les messages écrits dans les discussions de tes groupes et tes scores des saisons terminées : ils font partie des conversations et des classements d'autres personnes. Ils apparaissent comme « Compte supprimé ».",
        ],
      },
      {
        title: "Ce que tu peux exiger",
        paragraphs: [
          "Accéder à tes données, les corriger, les effacer, les emporter ailleurs, en limiter l'usage ou t'y opposer. La suppression, tu peux la faire toi-même depuis Profil, à tout moment.",
          `Pour le reste, écris à ${SOPORTE} : réponse sous un mois au maximum. Si tu estimes que cela a été mal fait, tu peux réclamer auprès de l'agence espagnole de protection des données (aepd.es).`,
        ],
      },
      {
        title: "Mineurs",
        paragraphs: [
          "Iromi ne s'adresse pas aux moins de 14 ans, l'âge à partir duquel la loi espagnole permet de consentir au traitement de ses propres données.",
        ],
      },
      {
        title: "Si cela change",
        paragraphs: [
          "Cet écran est mis à jour. Si le changement touche quelque chose d'important, comme une nouvelle donnée ou un nouveau prestataire, tu en es informé dans l'application avant son entrée en vigueur.",
        ],
      },
    ],
  },
  terms: {
    title: "Conditions d'utilisation",
    lead: "Voici les règles d'Iromi ; en créant un compte, tu les acceptes. Elles tiennent sur un écran.",
    blocks: [
      {
        title: "Ce qu'est Iromi",
        paragraphs: [
          `Un jeu de couleur. Chaque jour à 15h00, cinq images apparaissent avec une couleur retirée et tu as deux essais pour deviner laquelle ; l'Atelier fonctionne hors ligne et sans compte. Proposé par ${RESPONSABLE}.`,
        ],
      },
      {
        title: "Ton compte",
        paragraphs: [
          "Il en faut un pour jouer en groupe. Tu dois avoir au moins 14 ans, donner un e-mail qui est le tien et n'usurper l'identité de personne avec ton nom d'utilisateur. Tu es responsable de ce qui est fait depuis ton compte.",
          "Tu peux le supprimer quand tu veux depuis Profil, sans te justifier.",
        ],
      },
      {
        title: "Jouer avec les autres",
        paragraphs: [
          "Les groupes ont une discussion, et des personnes y écrivent. Insulter, harceler, menacer, publier les données d'autrui ou glisser de la publicité n'est pas autorisé. Truquer les classements avec de faux comptes ou des outils automatiques non plus.",
          "Ce que tu écris dans une discussion est vu par les membres de ce groupe. Iromi ne relit pas les messages un par un, mais peut retirer du contenu et fermer des comptes quand un abus est signalé.",
        ],
      },
      {
        title: "Un projet indépendant",
        paragraphs: [
          "Iromi est un projet indépendant. Il n'est ni affilié, ni associé, ni sponsorisé par aucune des marques dont les logos apparaissent dans le jeu.",
          "Les logos servent à identifier la marque dans une épreuve de couleur, comme un jeu de questions mentionne le titre d'un film. Ils restent la propriété de leurs titulaires.",
        ],
      },
      {
        title: "Personne ne gagne d'argent avec ça",
        paragraphs: [
          "Iromi est gratuit. Pas de publicité, pas d'achats intégrés, pas d'abonnement : les marques ne génèrent ici aucun revenu. Le jeu n'est présenté comme le produit officiel de personne.",
        ],
      },
      {
        title: "Si tu es titulaire d'une marque",
        paragraphs: [
          `Écris à ${SOPORTE} en indiquant qui tu représentes et elle est retirée du catalogue. Pas besoin d'autres motifs.`,
        ],
      },
      {
        title: "Ce qu'on peut attendre du service",
        paragraphs: [
          "Iromi est fourni tel quel. On essaie qu'il soit toujours disponible, mais rien ne garantit qu'il ne tombera pas en panne ni qu'il ne faudra pas l'arrêter pour maintenance, et les défis, les modes et les règles peuvent changer.",
        ],
      },
      {
        title: "Si tu ne respectes pas ces règles",
        paragraphs: [
          `Un compte qui harcèle, usurpe ou triche peut être suspendu ou fermé. Si tu penses que c'est une erreur, écris à ${SOPORTE}.`,
        ],
      },
      {
        title: "Responsabilité",
        paragraphs: [
          "Iromi répond des dommages qu'il cause par faute intentionnelle ou négligence grave, dans les termes de la loi. Il ne répond pas du contenu écrit par d'autres utilisateurs dans les discussions, ni des pannes du réseau ou de l'appareil depuis lequel tu joues.",
          "Rien de tout cela ne limite les droits que te reconnaît le droit de la consommation, qui prévaut toujours.",
        ],
      },
      {
        title: "Quelle loi s'applique",
        paragraphs: [
          "La loi espagnole. En cas de litige impossible à régler à l'amiable, les tribunaux du domicile du consommateur sont compétents.",
        ],
      },
    ],
  },
};

const ca: typeof es = {
  privacy: {
    title: "Privacitat",
    lead: "Iromi guarda només el que cal perquè el joc funcioni: qui ets, amb qui jugues i què has encertat. No hi ha publicitat ni rastrejadors, i les teves dades no es venen.",
    blocks: [
      {
        title: "Qui respon",
        paragraphs: [
          `El responsable del tractament és ${RESPONSABLE}, amb ${RESPONSABLE_ID}. Per a qualsevol cosa relacionada amb les teves dades, escriu a ${SOPORTE}.`,
        ],
      },
      {
        title: "Què es guarda i per a què",
        paragraphs: [
          "Hi ha tres grups de dades.",
          "El teu compte: el correu i el nom d'usuari amb què entres. Sense això no hi ha manera de reconèixer-te en tornar ni que els teus amics et trobin.",
          "El teu joc: l'experiència, el nivell, les puntuacions de cada jornada, els grups als quals pertanys i els missatges que escrius als seus xats.",
          "Els teus avisos: si actives les notificacions, l'identificador que el teu telèfon fa servir per rebre-les.",
          "No es recull res més: ni la teva ubicació, ni la teva agenda, ni quines altres aplicacions tens. No hi ha analítica ni rastreig publicitari.",
        ],
      },
      {
        title: "El que no surt del teu telèfon",
        paragraphs: [
          "Les partides del Taller, els teus rècords dels modes en solitari, l'idioma i si jugues en clar o fosc es guarden només al teu dispositiu. No viatgen a cap servidor.",
        ],
      },
      {
        title: "Amb quin dret",
        paragraphs: [
          "Per al compte i el joc, perquè cal per prestar-te el servei que has demanat (article 6.1.b del RGPD). Per a les notificacions, perquè tu les actives i les pots desactivar quan vulguis (article 6.1.a).",
        ],
      },
      {
        title: "Qui més les veu",
        paragraphs: [
          "Ningú compra ni ven aquestes dades. Iromi es recolza en quatre proveïdors, cadascun per a una sola cosa:",
          "Clerk guarda les credencials i verifica qui ets en entrar. Iromi no veu mai la teva contrasenya.",
          "Neon és la base de dades on viuen els grups, les puntuacions i els missatges.",
          "Fly.io són els servidors on funciona el joc.",
          "Expo lliura les notificacions al teu telèfon.",
          "Alguns són fora de la Unió Europea. En aquests casos la transferència s'empara en les clàusules contractuals tipus aprovades per la Comissió Europea.",
        ],
      },
      {
        title: "Quant de temps",
        paragraphs: [
          "Mentre tinguis compte. Quan l'elimines, s'esborren el teu nom, el teu correu, les teves credencials, la teva experiència, les teves amistats i els teus avisos.",
          "Es conserven, sense el teu nom, els missatges que vas escriure als xats dels teus grups i les teves puntuacions de temporades ja tancades: són part de converses i classificacions d'altres persones. Apareixen com a «Compte eliminat».",
        ],
      },
      {
        title: "Què pots exigir",
        paragraphs: [
          "Accedir a les teves dades, corregir-les, esborrar-les, endur-te-les a un altre lloc, limitar-ne l'ús o oposar-t'hi. L'esborrat el pots fer tu mateix des de Perfil, en qualsevol moment.",
          `Per a la resta, escriu a ${SOPORTE} i es respon en un termini màxim d'un mes. Si creus que no s'ha fet bé, pots reclamar davant l'Agència Espanyola de Protecció de Dades (aepd.es).`,
        ],
      },
      {
        title: "Menors",
        paragraphs: [
          "Iromi no s'adreça a menors de 14 anys, que és l'edat a partir de la qual la llei espanyola permet consentir el tractament de les pròpies dades.",
        ],
      },
      {
        title: "Si això canvia",
        paragraphs: [
          "S'actualitza aquesta pantalla. Si el canvi afecta alguna cosa important, com una dada nova o un proveïdor nou, s'avisa dins de l'aplicació abans que entri en vigor.",
        ],
      },
    ],
  },
  terms: {
    title: "Condicions d'ús",
    lead: "Aquestes són les regles d'Iromi, i en crear un compte les acceptes. Caben en una pantalla.",
    blocks: [
      {
        title: "Què és Iromi",
        paragraphs: [
          `Un joc de color. Cada dia a les 15:00 apareixen cinc imatges amb un color tret i tens dos intents per encertar quin era; el Taller funciona sense connexió i sense compte. L'ofereix ${RESPONSABLE}.`,
        ],
      },
      {
        title: "El teu compte",
        paragraphs: [
          "En cal un per jugar en grup. Has de tenir com a mínim 14 anys, donar un correu que sigui teu i no suplantar ningú amb el nom d'usuari. Ets responsable del que es faci des del teu compte.",
          "El pots eliminar quan vulguis des de Perfil, sense donar explicacions.",
        ],
      },
      {
        title: "Com es juga amb els altres",
        paragraphs: [
          "Els grups tenen xat, i allà hi escriuen persones. No es permet insultar, assetjar, amenaçar, publicar dades d'altri ni colar publicitat. Tampoc trampejar les classificacions amb comptes falsos o eines automàtiques.",
          "El que escrius en un xat ho veuen els membres d'aquell grup. Iromi no revisa els missatges un a un, però sí que pot retirar contingut i tancar comptes quan algú avisa d'un abús.",
        ],
      },
      {
        title: "Un projecte independent",
        paragraphs: [
          "Iromi és un projecte independent. No està afiliat, associat ni patrocinat per cap de les marques els logotips de les quals apareixen al joc.",
          "Els logotips es fan servir per identificar la marca dins d'una prova de color, com un joc de preguntes esmenta el títol d'una pel·lícula. Continuen sent dels seus propietaris.",
        ],
      },
      {
        title: "Ningú guanya diners amb això",
        paragraphs: [
          "Iromi és gratuït. No hi ha publicitat, ni compres dins de l'aplicació, ni subscripcions: les marques no generen aquí cap ingrés. El joc no es presenta com a producte oficial de ningú.",
        ],
      },
      {
        title: "Si ets titular d'una marca",
        paragraphs: [
          `Escriu a ${SOPORTE} indicant qui representes i es retira del catàleg. No cal donar més motius.`,
        ],
      },
      {
        title: "Què es pot esperar del servei",
        paragraphs: [
          "Iromi s'ofereix tal com és. S'intenta que estigui sempre disponible, però no es garanteix que no falli ni que no s'hagi d'aturar per manteniment, i els reptes, els modes i les regles poden canviar.",
        ],
      },
      {
        title: "Si incompleixes això",
        paragraphs: [
          `Un compte que assetja, suplanta o trampeja es pot suspendre o tancar. Si creus que ha estat un error, escriu a ${SOPORTE}.`,
        ],
      },
      {
        title: "Responsabilitat",
        paragraphs: [
          "Iromi respon dels danys que causi per dol o negligència greu, en els termes de la llei. No respon del contingut que escriguin altres usuaris als xats, ni de fallades de la xarxa o del dispositiu des del qual jugues.",
          "Res d'això limita els drets que et reconeix la normativa de consumidors, que sempre preval.",
        ],
      },
      {
        title: "Quina llei s'aplica",
        paragraphs: [
          "L'espanyola. Si hi ha una discussió que no es pugui resoldre parlant, seran competents els jutjats del domicili del consumidor.",
        ],
      },
    ],
  },
};

const DOCS: Record<Locale, { privacy: LegalDoc; terms: LegalDoc }> = { es, en, fr, ca };

/** El documento pedido, en el idioma pedido. */
export function legalDoc(locale: Locale, doc: "privacy" | "terms"): LegalDoc {
  return DOCS[locale][doc];
}
