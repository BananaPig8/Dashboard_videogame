// Equipo › Asignaciones: el trabajo abierto de cada persona y lo que no lleva nadie. Cada
// bloque enlaza a Tareas con el filtro de esa persona (?persona=).
import { Link } from 'react-router-dom'
import { TASK_NOBODY, teamAssignments } from '../../../domain/selectors'
import { yearOf } from '../../../domain/dates'
import { t } from '../../../i18n'
import { useStudioData } from '../../../data/store'
import { Card, Stat } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { ItemList } from '../../components/ItemList'
import { TagFilterNotice, useTagFilter } from '../../components/TagFilter'
import { useScope } from '../../context'
import { useToday } from '../../hooks'
import { MemberButton, openLabel, TeamEmpty } from './comunes'

const LIMIT = 6

export function EquipoAsignaciones() {
  const data = useStudioData()
  const { scope, href } = useScope()
  const today = useToday()
  const year = yearOf(today)
  const tag = useTagFilter()
  const { people, idle, nobody } = teamAssignments(data, scope, tag)
  const assigned = people.reduce((s, p) => s + p.items.length, 0)
  const tasksOf = (persona: string) => href(`/tareas?persona=${encodeURIComponent(persona)}${tag ? `&etiqueta=${encodeURIComponent(tag)}` : ''}`)
  const more = (n: number, persona: string) => (
    <Link to={tasksOf(persona)} className="small">
      {n > LIMIT ? t('secciones.equipo.asignaciones.seeAllInTasks', { n }) : t('secciones.equipo.asignaciones.seeInTasks')}
    </Link>
  )

  return (
    <>
      <TagFilterNotice />
      {!data.members.length && <TeamEmpty />}
      <div className="stats">
        <Stat label={t('secciones.equipo.asignaciones.open')} value={assigned + nobody.length} icon="list" />
        <Stat label={t('secciones.equipo.asignaciones.assigned')} value={assigned} icon="user" />
        <Stat label={t('secciones.equipo.asignaciones.nobody')} value={nobody.length} icon="question" tone={nobody.length ? 'warning' : 'neutral'} />
      </div>
      <Card
        title={t('secciones.equipo.asignaciones.nobodyTitle')}
        icon="question"
        subtitle={nobody.length ? t('secciones.equipo.asignaciones.nobodySubtitle') : undefined}
        action={nobody.length ? more(nobody.length, TASK_NOBODY) : undefined}
      >
        <ItemList
          items={nobody}
          data={data}
          showProject={!scope}
          limit={LIMIT}
          today={today}
          year={year}
          empty={
            assigned + nobody.length === 0
              ? tag
                ? t('secciones.equipo.asignaciones.noneTagged')
                : t('secciones.equipo.asignaciones.noWork')
              : t('secciones.equipo.asignaciones.nobodyNone')
          }
        />
      </Card>
      {people.length > 0 && (
        <div className="grid grid-2">
          {people.map(({ member, items }) => (
            <Card
              key={member.id}
              title={<MemberButton member={member} className="equipo-card-name" />}
              icon="user"
              subtitle={[member.role, openLabel(items.length)].filter(Boolean).join(' · ')}
              action={more(items.length, member.id)}
            >
              {!member.active && (
                <p className="equipo-warning small">
                  <Icon name="alert" size={14} /> {t('secciones.equipo.asignaciones.formerNote')}
                </p>
              )}
              <ItemList items={items} data={data} showProject={!scope} limit={LIMIT} today={today} year={year} />
            </Card>
          ))}
        </div>
      )}
      {idle.length > 0 && (
        <Card title={t('secciones.equipo.asignaciones.idleTitle')} icon="users" subtitle={t('secciones.equipo.asignaciones.idleSubtitle')}>
          <p className="equipo-owners">
            {idle.map((m) => (
              <MemberButton key={m.id} member={m} />
            ))}
          </p>
        </Card>
      )}
    </>
  )
}
