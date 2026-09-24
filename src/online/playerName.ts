import { t } from "@/i18n";

/**
 * El nombre con el que se pinta a otro jugador.
 *
 * ## Por qué hace falta una función para esto
 *
 * Una cuenta dada de baja **no desaparece de la base de datos**: se vacía. Su
 * fila sigue ahí porque de ella cuelgan cosas que son de otros —los mensajes
 * que escribió en los chats de sus grupos y sus puntuaciones en temporadas ya
 * cerradas—, y borrarla dejaría huecos en conversaciones ajenas y movería
 * clasificaciones de gente que no se ha dado de baja.
 *
 * Lo que sí se borra es la persona, y el servidor lo señala de la forma más
 * simple que hay: **el nombre llega vacío**. Ver `UserRepository.deleteAccount`
 * en el backend.
 *
 * ## Por qué el texto se pone aquí y no allí
 *
 * Porque «Cuenta eliminada» está traducido a cuatro idiomas y esa decisión es
 * del cliente. El servidor dice el hecho —no hay nadie—; la aplicación elige
 * cómo se dice.
 */
export function playerName(username: string | null | undefined): string {
  return username == null || username.trim() === ""
    ? t("common.deletedAccount")
    : username;
}
