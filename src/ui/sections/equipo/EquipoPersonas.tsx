// Equipo › Miembros y Equipo › Externos: las personas, activas y antiguas, con su papel,
// sus áreas, sus horas a la semana (si se apuntaron) y lo que llevan abierto.
import { teamRoster, teamWorkload, type TeamPerson } from '../../../domain/selectors'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Card, Empty, Stat } from '../../components/Common'
import { MePicker } from '../../components/MePicker'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { PeopleTable, TeamEmpty, type PeopleColumn } from './comunes'

/** Las personas con lo que se cuenta de ellas en el ámbito. */
function usePeople(kind?: 'external') {
  const data = useStudioData()
  const { scope } = useScope()
  const today = useToday()
  const roster = teamRoster(data, kind)
  const byId = new Map(teamWorkload(data, today, scope).people.map((p) => [p.member.id, p]))
  const rows = (list: typeof roster.active): TeamPerson[] => list.map((m) => byId.get(m.id)!).filter(Boolean)
  return { data, active: rows(roster.active), former: rows(roster.former) }
}

const MEMBER_COLUMNS: PeopleColumn[] = ['role', 'kind', 'areas', 'weekly', 'open']

export function EquipoMiembros() {
  const { data, active, former } = usePeople()
  const fmt = useFormat()
  if (!data.members.length) return <TeamEmpty />
  const withHours = active.filter((p) => p.member.weeklyHours !== undefined)
  const weekly = withHours.reduce((s, p) => s + (p.member.weeklyHours ?? 0), 0)
  return (
    <div className="equipo-grid">
      <div className="equipo-col">
        <Card title={t('secciones.equipo.miembros.activeTitle')} icon="users" subtitle={t('secciones.equipo.miembros.activeSubtitle')}>
          {active.length ? (
            <PeopleTable
              people={active}
              columns={MEMBER_COLUMNS}
              caption={t('secciones.equipo.table.caption', { group: t('secciones.equipo.miembros.activeTitle') })}
            />
          ) : (
            <Empty icon="users">{t('secciones.equipo.miembros.activeEmpty')}</Empty>
          )}
        </Card>
        {former.length > 0 && (
          <Card title={t('secciones.equipo.miembros.formerTitle')} icon="history" subtitle={t('secciones.equipo.miembros.formerSubtitle')}>
            <PeopleTable
              people={former}
              columns={['role', 'kind', 'areas', 'open']}
              caption={t('secciones.equipo.table.caption', { group: t('secciones.equipo.miembros.formerTitle') })}
            />
          </Card>
        )}
      </div>
      <div className="equipo-col">
        {/* «Quién soy yo» (ya trae su pregunta). La clave lo vuelve a montar al crear a alguien: así sale elegida esa persona. */}
        <MePicker key={data.members.length} />
        <Card title={t('secciones.equipo.miembros.summaryTitle')} icon="chart">
          <div className="stats">
            <Stat label={t('secciones.equipo.miembros.core')} value={active.filter((p) => p.member.kind === 'core').length} icon="home" />
            <Stat label={t('secciones.equipo.miembros.external')} value={active.filter((p) => p.member.kind === 'external').length} icon="link" />
            <Stat label={t('secciones.equipo.miembros.former')} value={former.length} icon="pause" />
          </div>
          {withHours.length ? (
            <p className="equipo-weekly">
              <strong>{t('secciones.equipo.miembros.weeklyTotal', { n: fmt.number(weekly) })}</strong>{' '}
              <span className="muted small">{t('secciones.equipo.miembros.weeklyHint', { n: withHours.length, total: active.length })}</span>
            </p>
          ) : (
            <p className="muted small">{t('secciones.equipo.miembros.weeklyNone')}</p>
          )}
        </Card>
      </div>
    </div>
  )
}

const EXTERNAL_COLUMNS: PeopleColumn[] = ['role', 'responsibilities', 'areas', 'open', 'minutes']

export function EquipoExternos() {
  const { data, active, former } = usePeople('external')
  const canEdit = useCanEdit()
  const { create } = useUI()
  if (!data.members.length) return <TeamEmpty />
  if (!active.length && !former.length)
    return (
      <Card>
        <Empty
          icon="link"
          action={canEdit ? { label: t('secciones.equipo.externos.create'), onClick: () => create('members', { kind: 'external' }) } : undefined}
        >
          {t('secciones.equipo.externos.none')}
        </Empty>
      </Card>
    )
  return (
    <>
      <Card title={t('secciones.equipo.externos.title')} icon="link" subtitle={t('secciones.equipo.externos.subtitle')}>
        {active.length ? (
          <PeopleTable
            people={active}
            columns={EXTERNAL_COLUMNS}
            caption={t('secciones.equipo.table.caption', { group: t('secciones.equipo.externos.title') })}
          />
        ) : (
          <Empty icon="link">{t('secciones.equipo.externos.none')}</Empty>
        )}
      </Card>
      {former.length > 0 && (
        <Card title={t('secciones.equipo.externos.formerTitle')} icon="history" subtitle={t('secciones.equipo.miembros.formerSubtitle')}>
          <PeopleTable
            people={former}
            columns={['role', 'responsibilities', 'open']}
            caption={t('secciones.equipo.table.caption', { group: t('secciones.equipo.externos.formerTitle') })}
          />
        </Card>
      )}
    </>
  )
}
