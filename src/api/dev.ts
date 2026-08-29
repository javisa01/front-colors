import type { ApiClient } from "./client";

/**
 * Herramientas de viaje en el tiempo del backend (apartado 5.5 del plan).
 *
 * **Estas rutas no existen en producción.** El backend no monta siquiera el
 * router `/api/dev` salvo que `NODE_ENV !== "production"` y
 * `DEV_TIME_TRAVEL=true`; en cualquier otro caso responden `404` como cualquier
 * ruta inexistente.
 *
 * Viven en su propio módulo, y no en `endpoints.ts`, justamente para que se vea
 * de un vistazo que son otra cosa: quien las use tiene que envolverlo en
 * `__DEV__` (ver `components/online/DevTimePanel.tsx`).
 *
 * Sirven para probar el ciclo de temporadas sin esperar 10 días reales. El
 * desfase vive en memoria del backend: si reinicias `npm run dev`, vuelve al
 * tiempo real y el grupo parecerá haber «resucitado».
 */

export interface DevTimeState {
  /** Desfase acumulado en milisegundos respecto al tiempo real. */
  offsetMs: number;
  /** El «ahora» efectivo del backend. */
  now: string;
  /** La hora de verdad, para poder comparar. */
  realNow: string;
}

export interface DevSeasonEnded {
  season: { id: string; seasonNumber: number; startsAt: string; endsAt: string };
}

export function createDevApi(client: ApiClient) {
  return {
    time: () => client.request<DevTimeState>("/dev/time"),

    /** El botón de «pasar un día». Con `{ days: 10 }` termina una temporada. */
    advance: (input: { days?: number; hours?: number; minutes?: number }) =>
      client.request<DevTimeState>("/dev/time/advance", {
        method: "POST",
        body: input,
      }),

    setTime: (iso: string) =>
      client.request<DevTimeState>("/dev/time/set", {
        method: "POST",
        body: { iso },
      }),

    reset: () =>
      client.request<DevTimeState>("/dev/time/reset", { method: "POST" }),

    /**
     * Termina la temporada de un grupo **sin tocar el reloj global**. Es lo más
     * cómodo para ver el estado «terminado» de un grupo concreto sin arrastrar
     * también las jornadas del reto diario.
     */
    endSeason: (groupId: string) =>
      client.request<DevSeasonEnded>(`/dev/groups/${groupId}/season/end`, {
        method: "POST",
      }),
  };
}

export type DevApi = ReturnType<typeof createDevApi>;
