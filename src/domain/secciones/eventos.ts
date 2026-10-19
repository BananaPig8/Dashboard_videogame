// Eventos del sector: inscripciones y su seguimiento.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones.
import { addDays } from '../dates'
import type { ISODate, StudioData, StudioEvent } from '../types'
import type { Scope } from '../selectors'

/** Inscripciones abiertas (o por abrir) cuyo plazo cierra entre hoy y dentro de `days` días. */
export function registrationsClosingSoon(data: StudioData, today: ISODate, days: number, scope: Scope = null): StudioEvent[] {
  const until = addDays(today, days)
  return data.events
    .filter((e) => scope === null || !e.projectId || e.projectId === scope)
    .filter(
      (e) =>
        e.status !== 'cancelled' &&
        (e.registrationStatus === 'open' || e.registrationStatus === 'not_open') &&
        !!e.registrationDeadline &&
        e.registrationDeadline >= today &&
        e.registrationDeadline <= until,
    )
    .sort((a, b) => a.registrationDeadline!.localeCompare(b.registrationDeadline!))
}
