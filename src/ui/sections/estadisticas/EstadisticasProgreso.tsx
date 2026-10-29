// Estadísticas › Progreso: lo hecho sobre el total de cada proyecto (sin lo descartado), sus
// hitos, su etapa y su salud. Con un proyecto elegido, el detalle por tipo y los motivos.
import { Link } from 'react-router-dom'
import { KINDS, TASK_KINDS } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { statsProgress, type StatsCount, type StatsProjectProgress } from '../../../domain/selectors'
import type { ItemKind } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { HealthPill, KindTag, StagePill } from '../../components/Badges'
import { Card, Empty, Progress, Stat } from '../../components/Common'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'

/** «12 de 40 · 30 %», con su barra; sin nada que contar, se dice (no es un 0 %). */
export function CountCell({ count, label }: { count: StatsCount; label: string }) {
  if (count.ratio === null) return <span className="muted">{t('secciones.estadisticas.common.nothingYet')}</span>
  return (
    <span className="estadisticas-count">
      <Progress ratio={count.ratio} label={label} />
      <span className="num nowrap">
        {t('secciones.estadisticas.common.of', { done: count.done, total: count.total })} ·{' '}
        {t('secciones.estadisticas.common.pct', { n: Math.round(count.ratio * 100) })}
      </span>
    </span>
  )
}

const sum = (rows: StatsProjectProgress[], pick: (r: StatsProjectProgress) => StatsCount): StatsCount => {
  const done = rows.reduce((s, r) => s + pick(r).done, 0)
  const total = rows.reduce((s, r) => s + pick(r).total, 0)
  const cancelled = rows.reduce((s, r) => s + pick(r).cancelled, 0)
  return { done, total, cancelled, ratio: total ? done / total : null }
}

function ByKind({ rows }: { rows: StatsProjectProgress[] }) {
  const L = (k: 'kind' | 'progress' | 'cancelled') => t(`secciones.estadisticas.progreso.${k}`)
  const kinds = TASK_KINDS.map((kind: ItemKind) => ({ kind, count: sum(rows, (r) => r.byKind.find((k) => k.kind === kind)!.count) }))
  return (
    <Card title={t('secciones.estadisticas.progreso.byKindTitle')} icon="layers" subtitle={t('secciones.estadisticas.progreso.byKindSubtitle')}>
      <div className="table-wrap">
        <table className="table estadisticas-table">
          <caption className="visually-hidden">{t('secciones.estadisticas.progreso.byKindTitle')}</caption>
          <thead>
            <tr>
              <th scope="col">{L('kind')}</th>
              <th scope="col">{L('progress')}</th>
              <th scope="col" className="num">
                {L('cancelled')}
              </th>
            </tr>
          </thead>
          <tbody>
            {kinds.map(({ kind, count }) => (
              <tr key={kind}>
                <th scope="row">
                  <KindTag kind={kind} />
                </th>
                <td data-label={L('progress')}>
                  <CountCell count={count} label={`${L('progress')}: ${KINDS[kind].plural}`} />
                </td>
                <td data-label={L('cancelled')} className="num">
                  {count.cancelled}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function EstadisticasProgreso() {
  const data = useStudioData()
  const { scope, href } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const fmt = useFormat()
  const tag = useTagFilter()
  const rows = statsProgress(data, today, scope, tag)

  if (!rows.length)
    return (
      <Card>
        <Empty icon="folder" action={canEdit ? { label: t('secciones.estadisticas.progreso.newProject'), onClick: () => create('projects') } : undefined}>
          {t('secciones.estadisticas.progreso.noProjects')}
        </Empty>
      </Card>
    )

  const tasks = sum(rows, (r) => r.tasks)
  const milestones = sum(rows, (r) => r.milestones)
  const total = (pick: (r: StatsProjectProgress) => number) => rows.reduce((s, r) => s + pick(r), 0)
  const blocked = total((r) => r.summary.blocked)
  const overdue = total((r) => r.summary.overdue)
  const toConfirm = total((r) => r.summary.toConfirm)
  const pct = (c: StatsCount) => (c.ratio === null ? undefined : t('secciones.estadisticas.common.pct', { n: Math.round(c.ratio * 100) }))
  const of = (c: StatsCount) => t('secciones.estadisticas.common.of', { done: c.done, total: c.total })
  const ofTotal = (c: StatsCount) =>
    c.ratio === null ? t('secciones.estadisticas.common.nothingYet') : t('secciones.estadisticas.common.ofTotal', { total: c.total, pct: pct(c) ?? '' })
  const L = (k: 'project' | 'stage' | 'health' | 'progress' | 'milestones' | 'open') => t(`secciones.estadisticas.progreso.${k}`)

  const tiles = (
    <div className="stats">
      {!scope && <Stat label={t('secciones.estadisticas.progreso.projects')} value={rows.length} icon="folder" />}
      <Stat label={t('secciones.estadisticas.progreso.tasks')} value={tasks.done} hint={ofTotal(tasks)} icon="checkCircle" />
      <Stat label={t('secciones.estadisticas.progreso.milestones')} value={milestones.done} hint={ofTotal(milestones)} icon="flag" />
      <Stat label={t('secciones.estadisticas.progreso.open')} value={total((r) => r.summary.open)} icon="list" to={href('/tareas')} />
      <Stat
        label={t('secciones.estadisticas.progreso.blocked')}
        value={blocked}
        icon="lock"
        tone={blocked ? 'danger' : 'neutral'}
        to={href('/tareas?filtro=bloqueadas')}
      />
      <Stat
        label={t('secciones.estadisticas.progreso.overdue')}
        value={overdue}
        icon="clock"
        tone={overdue ? 'danger' : 'neutral'}
        to={href('/tareas?filtro=vencidas')}
      />
      <Stat
        label={t('secciones.estadisticas.progreso.toConfirm')}
        value={toConfirm}
        icon="question"
        tone={toConfirm ? 'warning' : 'neutral'}
        to={href('/tareas?estado=to_confirm')}
      />
    </div>
  )

  if (scope) {
    const r = rows[0]
    const { health, lastActivity } = r.summary
    return (
      <>
        {tiles}
        <div className="estadisticas-grid">
          <ByKind rows={rows} />
          <Card title={t('secciones.estadisticas.progreso.healthTitle')} icon="activity" subtitle={t('secciones.estadisticas.progreso.healthSubtitle')}>
            <p className="estadisticas-pills">
              <StagePill stage={r.project.stage} />
              <HealthPill level={health.level} />
            </p>
            {health.reasons.length ? (
              <ul className="estadisticas-reasons">
                {health.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t('secciones.estadisticas.progreso.noReasons')}</p>
            )}
            <p className="muted small">
              {lastActivity
                ? t('secciones.estadisticas.progreso.lastActivity', { date: fmt.date(lastActivity, yearOf(today)) })
                : t('secciones.estadisticas.progreso.noActivity')}
            </p>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      {tiles}
      <Card title={t('secciones.estadisticas.progreso.byProjectTitle')} icon="folder" subtitle={t('secciones.estadisticas.progreso.byProjectSubtitle')}>
        <div className="table-wrap">
          <table className="table estadisticas-table">
            <caption className="visually-hidden">{t('secciones.estadisticas.progreso.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{L('project')}</th>
                <th scope="col">{L('stage')}</th>
                <th scope="col">{L('health')}</th>
                <th scope="col">{L('progress')}</th>
                <th scope="col">{L('milestones')}</th>
                <th scope="col" className="num">
                  {L('open')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.project.id}>
                  <th scope="row">
                    <Link to={`/proyectos/${r.project.slug}/estadisticas`} className="estadisticas-project">
                      <span className="dot" style={{ background: r.project.color }} aria-hidden="true" />
                      {r.project.name}
                    </Link>
                  </th>
                  <td data-label={L('stage')}>
                    <StagePill stage={r.project.stage} />
                  </td>
                  <td data-label={L('health')}>
                    <span title={r.summary.health.reasons.join(' · ') || undefined}>
                      <HealthPill level={r.summary.health.level} />
                    </span>
                  </td>
                  <td data-label={L('progress')}>
                    <CountCell count={r.tasks} label={`${L('progress')}: ${r.project.name}`} />
                  </td>
                  <td data-label={L('milestones')} className="nowrap">
                    {r.milestones.ratio === null ? <span className="muted">{t('secciones.estadisticas.common.nothingYet')}</span> : of(r.milestones)}
                  </td>
                  <td data-label={L('open')} className="num">
                    {r.summary.open}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ByKind rows={rows} />
    </>
  )
}
