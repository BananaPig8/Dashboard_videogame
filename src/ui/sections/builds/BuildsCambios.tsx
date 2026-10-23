// Historial de cambios: lo hecho entre una build y la siguiente (commits, PR y elementos
// terminados) con lo que cada build dice que cambia. Los filtros van en la URL (?q=, ?area=,
// ?git=0): así se pueden guardar como vista y no se pierden al volver.
import { useSearchParams } from 'react-router-dom'
import { addDays, yearOf } from '../../../domain/dates'
import {
  activityOf,
  buildStretches,
  changelogLines,
  itemsOf,
  matchesQuery,
  normalize,
  undatedBuilds,
  weeklyEvolution,
  type BuildStretch,
} from '../../../domain/selectors'
import type { Activity, Build, WorkItem } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { AreaTag, BuildChannelPill, BuildStatusPill, ConfidenceTag, KindIcon } from '../../components/Badges'
import { WeeklyChart } from '../../components/Charts'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { SaveViewButton } from '../../components/SaveView'
import { SectionHeader } from '../../components/SectionHeader'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { usePreferences } from '../../prefs'
import type { SectionPageProps } from '../registry'

/** Hasta cuántos terminados o commits se enseñan abiertos; con más, se pliegan. */
const OPEN_LIMIT = 8

const countDone = (n: number) => t(n === 1 ? 'secciones.builds.cambios.count.doneOne' : 'secciones.builds.cambios.count.doneMany', { n })
const countGit = (n: number) => t(n === 1 ? 'secciones.builds.cambios.count.gitOne' : 'secciones.builds.cambios.count.gitMany', { n })

export function BuildsCambios({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, project } = useScope()
  const today = useToday()
  const year = yearOf(today)
  const { weekStart } = usePreferences()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const area = params.get('area') ?? ''
  const showGit = params.get('git') !== '0'
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const nq = normalize(q.trim())
  const allActivity = activityOf(data, scope)
  const allDone = itemsOf(data, scope).filter((i) => i.status === 'done' && i.completedAt)
  const activity = showGit ? allActivity.filter((a) => (!area || a.areaId === area) && (!nq || normalize(`${a.title} ${a.ref ?? ''}`).includes(nq))) : []
  const done = allDone.filter((i) => (!area || i.areaId === area) && matchesQuery(i, q))
  const filtered = !!(q || area || !showGit)

  // Cada proyecto con algo que contar (con uno elegido, ese).
  const projects = scope
    ? data.projects.filter((p) => p.id === scope)
    : data.projects.filter((p) => [...data.builds, ...allActivity, ...allDone].some((x) => x.projectId === p.id))

  return (
    <div className={embedded ? 'builds-page' : 'page builds-page'}>
      <SectionHeader
        id="builds"
        embedded={embedded}
        actions={!embedded ? <SaveViewButton suggestedName={t('nav.children.builds.cambios')} /> : undefined}
        subtitle={project ? t('secciones.builds.subtitleIn', { project: project.name }) : undefined}
      />
      <p className="builds-intro">
        {t('secciones.builds.cambios.intro')} <span className="muted">{t('secciones.builds.cambios.sameDay')}</span>
      </p>
      <Card title={t('secciones.builds.cambios.evolution')} icon="activity" subtitle={t('secciones.builds.cambios.evolutionSub')}>
        <WeeklyChart buckets={weeklyEvolution(data, today, 8, scope, weekStart)} year={year} />
      </Card>
      <div className="filters" role="group" aria-label={t('secciones.builds.cambios.filters.label')}>
        <input
          type="search"
          placeholder={t('secciones.builds.cambios.filters.search')}
          value={q}
          onChange={(e) => set('q', e.target.value)}
          aria-label={t('secciones.builds.cambios.filters.searchLabel')}
        />
        <select value={area} onChange={(e) => set('area', e.target.value)} aria-label={t('secciones.builds.cambios.filters.area')}>
          <option value="">{t('secciones.builds.cambios.filters.areaAll')}</option>
          {data.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="check-field">
          <input type="checkbox" checked={showGit} onChange={(e) => set('git', e.target.checked ? '' : '0')} /> {t('secciones.builds.cambios.filters.git')}
        </label>
        <span className="spacer" />
        <span className="muted small" aria-live="polite">
          {countDone(done.length)} · {countGit(activity.length)}
        </span>
      </div>
      {projects.length === 0 ? (
        <Card>
          <Empty icon="history">{t('secciones.builds.cambios.empty')}</Empty>
        </Card>
      ) : (
        projects.map((p) => (
          <ProjectHistory
            key={p.id}
            title={scope ? t('secciones.builds.cambios.projectTitle') : p.name}
            builds={data.builds.filter((b) => b.projectId === p.id)}
            activity={activity.filter((a) => a.projectId === p.id)}
            done={done.filter((i) => i.projectId === p.id)}
            filtered={filtered}
          />
        ))
      )}
    </div>
  )
}

function ProjectHistory({
  title,
  builds,
  activity,
  done,
  filtered,
}: {
  title: string
  builds: Build[]
  activity: Activity[]
  done: WorkItem[]
  filtered: boolean
}) {
  const { edit } = useUI()
  const stretches = buildStretches(builds, activity, done)
  const undated = undatedBuilds(builds)
  return (
    <Card title={title} icon="history" subtitle={`${countDone(done.length)} · ${countGit(activity.length)}`} className="builds-history">
      {stretches.length === 0 ? (
        <Empty icon="history">{filtered ? t('secciones.builds.cambios.emptyFiltered') : t('secciones.builds.cambios.empty')}</Empty>
      ) : (
        <ol className="builds-stretches">
          {stretches.map((s, k) => (
            <Stretch key={s.date ?? 'abierto'} stretch={s} filtered={filtered} first={k === 0} />
          ))}
        </ol>
      )}
      {undated.length > 0 && (
        <div className="builds-undated">
          <h3 className="subhead">{t('secciones.builds.cambios.undated')}</h3>
          <ul className="pills">
            {undated.map((b) => (
              <li key={b.id}>
                <button type="button" className="chip-btn" onClick={() => edit({ collection: 'builds', id: b.id })}>
                  {b.name} <span className="version-tag">v{b.version}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Stretch({ stretch: s, filtered, first }: { stretch: BuildStretch; filtered: boolean; first: boolean }) {
  const { edit, openItem } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const areas = new Map(useStudioData().areas.map((a) => [a.id, a]))
  const from = s.since ? fmt.date(addDays(s.since, 1), year) : undefined
  const to = s.date ? fmt.date(s.date, year) : undefined
  const range = !to
    ? t('secciones.builds.cambios.stretch.from', { from: from ?? '' })
    : !from
      ? t('secciones.builds.cambios.stretch.until', { to })
      : from === to
        ? t('secciones.builds.cambios.stretch.day')
        : t('secciones.builds.cambios.stretch.range', { from, to })
  const logs = s.builds.map((b) => ({ build: b, lines: changelogLines(b) })).filter((x) => x.lines.length)
  const missingLog = s.builds.filter((b) => !changelogLines(b).length)
  const empty = !s.activity.length && !s.done.length
  return (
    <li className={s.date ? 'builds-stretch' : 'builds-stretch open'}>
      <div className="builds-stretch-head">
        <h3>{s.date ? fmt.longDate(s.date) : t('secciones.builds.cambios.stretch.open')}</h3>
        <span className="muted small">{s.date || from ? range : t('secciones.builds.cambios.stretch.openHint')}</span>
      </div>
      {s.builds.length > 0 && (
        <ul className="builds-stretch-builds">
          {s.builds.map((b) => (
            <li key={b.id}>
              <button type="button" className="item-title" onClick={() => edit({ collection: 'builds', id: b.id })}>
                {b.name}
              </button>
              <span className="version-tag">v{b.version}</span>
              <BuildChannelPill channel={b.channel} />
              <BuildStatusPill status={b.status} />
              <ConfidenceTag confidence={b.confidence} compact />
            </li>
          ))}
        </ul>
      )}
      {logs.map(({ build, lines }) => (
        <div key={build.id} className="builds-changelog">
          <h4 className="subhead">{t('secciones.builds.cambios.stretch.changelog', { build: build.name })}</h4>
          <ul>
            {lines.map((l, k) => (
              <li key={k}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
      {missingLog.length > 0 && (
        <p className="muted small builds-nolog">
          {missingLog.length === 1
            ? t('secciones.builds.cambios.stretch.noChangelogOne', { build: missingLog[0].name })
            : t('secciones.builds.cambios.stretch.noChangelog')}
          {canEdit && missingLog.length === 1 && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => edit({ collection: 'builds', id: missingLog[0].id })}>
              <Icon name="edit" size={14} /> {t('secciones.builds.cambios.stretch.addChangelog', { build: missingLog[0].name })}
            </button>
          )}
        </p>
      )}
      {empty && (
        <p className="muted small">{filtered ? t('secciones.builds.cambios.stretch.nothingFiltered') : t('secciones.builds.cambios.stretch.nothing')}</p>
      )}
      {s.done.length > 0 && (
        <details className="builds-done" open={s.done.length <= OPEN_LIMIT}>
          <summary>
            <Icon name="checkCircle" size={14} /> {countDone(s.done.length)}
          </summary>
          <ul className="history-items">
            {s.done.map((i) => (
              <li key={i.id}>
                <KindIcon kind={i.kind} />
                <button type="button" className="item-title" onClick={() => openItem(i.id)}>
                  {i.title}
                </button>
                <span className="muted small nowrap">{fmt.date(i.completedAt!, year)}</span>
                <AreaTag area={i.areaId ? areas.get(i.areaId) : undefined} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {s.activity.length > 0 && (
        <details className="history-git" open={first && s.activity.length <= OPEN_LIMIT}>
          <summary>
            <Icon name="git" size={14} /> {countGit(s.activity.length)}
          </summary>
          <ul>
            {s.activity.map((a) => (
              <li key={a.id}>
                <span className="muted small nowrap">
                  {fmt.date(a.at.slice(0, 10), year)}, {fmt.time(a.at)}
                </span>
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer noopener" className="git-ref">
                    {a.ref}
                  </a>
                ) : (
                  <span className="git-ref">{a.ref}</span>
                )}
                <span className={a.type === 'merge' ? 'git-merge' : undefined}>{a.title}</span>
                {a.note && <span className="muted small">({a.note})</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}
