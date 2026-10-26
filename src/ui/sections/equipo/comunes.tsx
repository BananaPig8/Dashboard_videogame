// Piezas comunes de la sección «Equipo»: el estado vacío (sin nadie no se inventa a nadie),
// la relación de cada persona y la tabla de personas.
import { Link } from 'react-router-dom'
import type { TeamPerson } from '../../../domain/selectors'
import type { Member } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit } from '../../../data/store'
import { AreaTag, Pill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { useMe } from '../../components/MePicker'
import { useFormat } from '../../hooks'
import { useScope, useUI } from '../../context'

/** Sin nadie en el equipo: para qué sirve y cómo empezar. */
export function TeamEmpty() {
  const canEdit = useCanEdit()
  const { create } = useUI()
  return (
    <Card title={t('secciones.equipo.empty.title')} icon="users">
      <Empty icon="users" action={canEdit ? { label: t('secciones.equipo.empty.create'), onClick: () => create('members') } : undefined}>
        {t('secciones.equipo.empty.text')}
      </Empty>
    </Card>
  )
}

/** Del estudio, externa o ya fuera del equipo (siempre con icono y texto). */
export function MemberKindPill({ member }: { member: Member }) {
  if (!member.active)
    return (
      <Pill tone="muted" icon="pause">
        {t('secciones.equipo.kind.former')}
      </Pill>
    )
  return member.kind === 'core' ? (
    <Pill tone="neutral" icon="home">
      {t('secciones.equipo.kind.core')}
    </Pill>
  ) : (
    <Pill tone="info" icon="link">
      {t('secciones.equipo.kind.external')}
    </Pill>
  )
}

/** El nombre de una persona: abre su ficha en el editor. */
export function MemberButton({ member, className = 'link-btn' }: { member: Member; className?: string }) {
  const { edit } = useUI()
  return (
    <button type="button" className={className} onClick={() => edit({ collection: 'members', id: member.id })}>
      {member.name}
    </button>
  )
}

export const openLabel = (n: number) =>
  n === 0 ? t('secciones.equipo.values.nothingOpen') : n === 1 ? t('secciones.equipo.values.openOne') : t('secciones.equipo.values.openMany', { n })

/** Lo abierto que lleva una persona, con enlace a Tareas y los vencidos y bloqueados marcados. */
export function OpenWork({ person, hideOverdue }: { person: Pick<TeamPerson, 'open' | 'overdue' | 'blocked'> & { member?: Member }; hideOverdue?: boolean }) {
  const { href } = useScope()
  if (person.open === 0) return <span className="muted">{openLabel(0)}</span>
  const label = openLabel(person.open)
  return (
    <span className="equipo-open">
      {person.member ? <Link to={href(`/tareas?persona=${encodeURIComponent(person.member.id)}`)}>{label}</Link> : label}
      {!hideOverdue && person.overdue > 0 && (
        <Pill tone="danger" icon="clock">
          {person.overdue === 1 ? t('secciones.equipo.values.overdueOne') : t('secciones.equipo.values.overdueMany', { n: person.overdue })}
        </Pill>
      )}
      {person.blocked > 0 && (
        <Pill tone="danger" icon="lock">
          {person.blocked === 1 ? t('secciones.equipo.values.blockedOne') : t('secciones.equipo.values.blockedMany', { n: person.blocked })}
        </Pill>
      )}
      {person.member && !person.member.active && (
        <Pill tone="warning" icon="alert">
          {t('secciones.equipo.values.reassign')}
        </Pill>
      )}
    </span>
  )
}

export type PeopleColumn = 'role' | 'kind' | 'areas' | 'weekly' | 'open' | 'responsibilities' | 'minutes'

/** Tabla de personas (en móvil, cada fila es una tarjeta). El nombre abre su ficha. */
export function PeopleTable({ people, columns, caption }: { people: TeamPerson[]; columns: PeopleColumn[]; caption: string }) {
  const fmt = useFormat()
  const me = useMe()
  const L = (c: PeopleColumn | 'name') => t(`secciones.equipo.table.${c}`)
  const cell = (p: TeamPerson, c: PeopleColumn) => {
    const m = p.member
    switch (c) {
      case 'role':
        return m.role || <span className="muted">{t('secciones.equipo.values.noRole')}</span>
      case 'kind':
        return <MemberKindPill member={m} />
      case 'areas':
        return p.areas.length ? (
          <span className="equipo-areas">
            {p.areas.map((a) => (
              <AreaTag key={a.id} area={a} />
            ))}
          </span>
        ) : (
          <span className="muted">{t('secciones.equipo.values.noAreas')}</span>
        )
      case 'weekly':
        return m.weeklyHours !== undefined ? (
          t('secciones.equipo.values.hoursWeek', { n: fmt.number(m.weeklyHours) })
        ) : (
          <span className="muted">{t('secciones.equipo.values.noHours')}</span>
        )
      case 'open':
        return <OpenWork person={p} />
      case 'responsibilities':
        return m.responsibilities ? (
          <span className="equipo-text">{m.responsibilities}</span>
        ) : (
          <span className="muted">{t('secciones.equipo.values.undescribed')}</span>
        )
      case 'minutes':
        return p.minutes ? fmt.duration(p.minutes) : <span className="muted">{t('secciones.equipo.values.noTime')}</span>
    }
  }
  return (
    <div className="table-wrap">
      <table className="table equipo-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{L('name')}</th>
            {columns.map((c) => (
              <th key={c} scope="col">
                {L(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.member.id}>
              <th scope="row" className="record-title">
                <span className="equipo-name">
                  <MemberButton member={p.member} />
                  {me?.id === p.member.id && (
                    <Pill tone="special" icon="user">
                      {t('secciones.equipo.kind.me')}
                    </Pill>
                  )}
                </span>
              </th>
              {columns.map((c) => (
                <td key={c} data-label={L(c)}>
                  {cell(p, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
