// Piezas comunes de las vistas de Documentación: la página (cabecera de la sección, aviso de
// etiqueta y la explicación de la subsección), el botón de crear y la reunión de la que sale algo.
import type { ReactNode } from 'react'
import type { StudioEvent } from '../../../domain/types'
import { useCanEdit } from '../../../data/store'
import { t } from '../../../i18n'
import { Icon } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { TagFilterNotice } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { yearOf } from '../../../domain/dates'
import type { CollectionKey } from '../../../data/store'
import './documentacion.css'

/** La página de una vista: cabecera, aviso de etiqueta, explicación y contenido. */
export function DocumentacionPage({ embedded, actions, intro, children }: { embedded?: boolean; actions?: ReactNode; intro: string; children: ReactNode }) {
  const { project } = useScope()
  return (
    <div className={embedded ? 'documentacion-page' : 'page documentacion-page'}>
      <SectionHeader
        id="documentacion"
        embedded={embedded}
        actions={actions}
        subtitle={project ? t('secciones.documentacion.subtitleIn', { project: project.name }) : undefined}
      />
      <TagFilterNotice />
      <p className="documentacion-intro">{intro}</p>
      {children}
    </div>
  )
}

/** Botón de crear (solo si se puede escribir). */
export function NewButton({
  collection,
  defaults,
  label,
  primary,
  small,
}: {
  collection: CollectionKey
  defaults?: Record<string, unknown>
  label: string
  primary?: boolean
  small?: boolean
}) {
  const { create } = useUI()
  if (!useCanEdit()) return null
  const className = ['btn', primary && 'btn-primary', small && 'btn-small'].filter(Boolean).join(' ')
  return (
    <button type="button" className={className} onClick={() => create(collection, defaults)}>
      <Icon name="plus" size={small ? 14 : 16} /> {label}
    </button>
  )
}

/** La reunión o el evento de la que sale algo: abre el evento (o dice que ya no existe). */
export function EventRef({ event, missing }: { event?: StudioEvent; missing?: boolean }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const year = yearOf(useToday())
  if (!event)
    return missing ? (
      <span className="meta-date">
        <Icon name="alert" size={12} /> {t('secciones.documentacion.minutes.missingMeeting')}
      </span>
    ) : null
  const name = event.type === 'meeting' ? t('secciones.documentacion.decisions.fromMeeting', { name: event.title }) : t('secciones.documentacion.decisions.fromEvent', { name: event.title })
  return (
    <button type="button" className="link-btn meta-date documentacion-event" onClick={() => edit({ collection: 'events', id: event.id })}>
      <Icon name={event.type === 'meeting' ? 'users' : 'calendar'} size={12} /> {name}
      {event.date && ` · ${fmt.date(event.date, year)}`}
    </button>
  )
}
