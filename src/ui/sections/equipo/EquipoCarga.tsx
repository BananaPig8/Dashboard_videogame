// Equipo › Carga: lo que lleva cada persona ponderado por prioridad, lo vencido y las horas
// apuntadas en las últimas cuatro semanas frente a sus horas a la semana. Sin horas a la
// semana en su ficha no hay capacidad que comparar: se dice, no se supone una jornada.
import type { ReactNode } from 'react'
import { teamWorkload, type TeamLoad, type TeamPerson } from '../../../domain/selectors'
import { yearOf } from '../../../domain/dates'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Pill } from '../../components/Badges'
import { Card, Empty, Progress } from '../../components/Common'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { MemberButton, MemberKindPill, OpenWork, TeamEmpty } from './comunes'

type Col = 'open' | 'load' | 'overdue' | 'minutes' | 'capacity' | 'usage'
const COLS: Col[] = ['open', 'load', 'overdue', 'minutes', 'capacity', 'usage']

/** En la fila «Sin asignar» no hay capacidad: se ve una raya y se lee el texto. */
function NotApplicable() {
  return (
    <>
      <span className="muted" aria-hidden="true">
        —
      </span>
      <span className="visually-hidden">{t('secciones.equipo.carga.notApplicable')}</span>
    </>
  )
}

export function EquipoCarga() {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const fmt = useFormat()
  const year = yearOf(today)
  const w = teamWorkload(data, today, scope)
  if (!data.members.length) return <TeamEmpty />

  // Las antiguas solo si aún tienen algo (trabajo u horas del periodo).
  const rows = w.people.filter((p) => p.member.active || p.open > 0 || p.minutes > 0)
  const maxLoad = Math.max(1, w.nobody.load, ...rows.map((p) => p.load))
  const L = (c: Col) => t(`secciones.equipo.carga.${c}`)

  const cells = (l: TeamLoad, p?: TeamPerson): Record<Col, ReactNode> => ({
    open: <OpenWork person={{ ...l, member: p?.member }} hideOverdue />,
    load: (
      <span className="equipo-load">
        <span className="equipo-bar" aria-hidden="true">
          <span style={{ width: `${(l.load / maxLoad) * 100}%` }} />
        </span>
        <span className="num nowrap">{l.load === 1 ? t('secciones.equipo.carga.loadOne') : t('secciones.equipo.carga.loadValue', { n: l.load })}</span>
      </span>
    ),
    overdue: l.overdue ? (
      <Pill tone="danger" icon="clock">
        {fmt.number(l.overdue)}
      </Pill>
    ) : (
      <span className="muted">{t('secciones.equipo.carga.none')}</span>
    ),
    minutes: l.minutes ? <span className="num">{fmt.duration(l.minutes)}</span> : <span className="muted">{t('secciones.equipo.values.noTime')}</span>,
    capacity:
      p?.capacity != null ? (
        <span className="num">{t('secciones.equipo.carga.capacityValue', { total: fmt.duration(p.capacity), n: fmt.number(p.member.weeklyHours ?? 0) })}</span>
      ) : p ? (
        <span className="muted">{t('secciones.equipo.carga.noCapacity')}</span>
      ) : (
        <NotApplicable />
      ),
    usage:
      p?.ratio != null ? (
        <span className="equipo-usage">
          <Progress ratio={p.ratio} tone={p.ratio > 1 ? 'warning' : 'info'} label={`${L('usage')}: ${p.member.name}`} />
          <span className="num">{Math.round(p.ratio * 100)} %</span>
          {p.ratio > 1 && (
            <Pill tone="warning" icon="alert">
              {t('secciones.equipo.carga.over')}
            </Pill>
          )}
        </span>
      ) : p ? (
        <span className="muted">{t('secciones.equipo.carga.usageNone')}</span>
      ) : (
        <NotApplicable />
      ),
  })

  return (
    <>
      <p className="equipo-note">{t('secciones.equipo.carga.intro', { from: fmt.date(w.from, year), to: fmt.date(w.to, year) })}</p>
      <Card title={t('secciones.equipo.carga.title')} icon="scale" subtitle={t('secciones.equipo.carga.subtitle')}>
        <div className="table-wrap">
          <table className="table equipo-table">
            <caption className="visually-hidden">{t('secciones.equipo.carga.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('secciones.equipo.carga.person')}</th>
                {COLS.map((c) => (
                  <th key={c} scope="col">
                    {L(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const c = cells(p, p)
                return (
                  <tr key={p.member.id}>
                    <th scope="row" className="record-title">
                      <span className="equipo-name">
                        <MemberButton member={p.member} />
                        {(p.member.kind === 'external' || !p.member.active) && <MemberKindPill member={p.member} />}
                      </span>
                      {p.member.role && <span className="muted small equipo-role">{p.member.role}</span>}
                    </th>
                    {COLS.map((k) => (
                      <td key={k} data-label={L(k)}>
                        {c[k]}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {(w.nobody.open > 0 || w.nobody.minutes > 0) && (
                <tr className="equipo-nobody">
                  <th scope="row" className="record-title">
                    {t('secciones.equipo.carga.nobodyRow')}
                    <span className="muted small equipo-role">{t('secciones.equipo.carga.nobodyHint')}</span>
                  </th>
                  {COLS.map((k) => (
                    <td key={k} data-label={L(k)}>
                      {cells(w.nobody)[k]}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!w.anyTime && (
          <Empty
            icon="clock"
            action={canEdit ? { label: t('secciones.equipo.actions.logTime'), onClick: () => create('timeEntries'), icon: 'clock' } : undefined}
          >
            {t('secciones.equipo.carga.noTime', { from: fmt.date(w.from, year), to: fmt.date(w.to, year) })}
          </Empty>
        )}
      </Card>
    </>
  )
}
