// Exportar a .ics: un fichero para importar en otro calendario (RFC 5545, toICS en
// domain/secciones/calendario.ts). No es una sincronización: no hay ninguna integración
// activa, y la tarjeta lo dice.
import { CALENDAR_KINDS, type CalendarKind } from '../../../domain/catalog'
import { calendarForExport, toICS, type CalendarEntry, type IcsEntry, type Scope } from '../../../domain/selectors'
import type { StudioData } from '../../../domain/types'
import { t } from '../../../i18n'
import { Card } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useNotify } from '../../feedback'
import { saveFile } from '../../files'
import { useToday } from '../../hooks'
import { usePreferences } from '../../prefs'

/** Cada fecha con lo que ayuda en el otro calendario: tipo, proyecto, hora, lugar y notas. */
function withDetails(data: StudioData, entries: CalendarEntry[]): IcsEntry[] {
  return entries.map((e) => {
    const ev = e.target.collection === 'events' ? data.events.find((x) => x.id === e.target.id) : undefined
    const registration = e.kind === 'registration'
    const project = data.projects.find((p) => p.id === e.projectId)
    const lines = [
      t('secciones.calendario.export.kind', { kind: CALENDAR_KINDS[e.kind].label }),
      project ? t('secciones.calendario.export.project', { project: project.name }) : t('secciones.calendario.export.studio'),
      ...(e.time ? [t('secciones.calendario.export.time', { time: e.time })] : []),
      ...(e.confirmed ? [] : [t('secciones.calendario.export.unconfirmed')]),
      ...(ev?.notes && !registration ? [ev.notes] : []),
    ]
    return {
      ...e,
      endTime: registration ? undefined : ev?.endTime,
      location: registration ? undefined : ev?.location,
      url: registration ? ev?.registrationUrl : ev?.url,
      description: lines.join('\n'),
    }
  })
}

export function CalendarioExportar({
  data,
  scope,
  kinds,
  tag,
  what,
}: {
  data: StudioData
  scope: Scope
  kinds?: readonly CalendarKind[]
  tag: string | null
  /** Qué se exporta, para el nombre del calendario («Indie Dev Tycoon · Reuniones»). */
  what: string
}) {
  const today = useToday()
  const { timeZone } = usePreferences()
  const { toast } = useNotify()
  const entries = calendarForExport(data, today, scope, kinds, tag)
  const n = entries.length

  const download = async () => {
    const text = toICS(withDetails(data, entries), { calName: t('secciones.calendario.export.calName', { what }), timeZone })
    const result = await saveFile('calendario.ics', text, 'text/calendar')
    if (result === 'saved') toast(n === 1 ? t('secciones.calendario.export.savedOne') : t('secciones.calendario.export.saved', { n }))
    else if (result === 'unavailable') toast({ message: t('secciones.calendario.export.unavailable'), tone: 'danger' })
  }

  return (
    <Card title={t('secciones.calendario.export.title')} icon="download">
      <p className="calendario-note">
        <Icon name="info" size={14} /> {t('secciones.calendario.export.hint')}
      </p>
      <p className="muted small">
        {n === 0 ? t('secciones.calendario.export.none') : n === 1 ? t('secciones.calendario.export.countOne') : t('secciones.calendario.export.count', { n })}
      </p>
      <div>
        <button type="button" className="btn btn-small" onClick={download} disabled={n === 0}>
          <Icon name="download" size={14} /> {t('secciones.calendario.export.button')}
        </button>
      </div>
    </Card>
  )
}
