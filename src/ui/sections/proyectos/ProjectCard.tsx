// La tarjeta de un proyecto: portada, datos del juego, salud y etapa, progreso (con su método),
// próximo hito, trabajo abierto y bloqueado, y la última actividad. La usan Proyectos y el
// Dashboard (también dentro de un proyecto). Los cálculos están en domain/secciones/proyectos.ts.
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, yearOf } from '../../../domain/dates'
import {
  dailyCommits,
  projectLastActivity,
  projectNextMilestone,
  projectProgress,
  type ProjectActivitySource,
  type ProjectProgress,
  type ProjectSummary,
} from '../../../domain/selectors'
import type { Project, StudioData } from '../../../domain/types'
import { t } from '../../../i18n'
import { HealthPill, Pill, StagePill } from '../../components/Badges'
import { Sparkline } from '../../components/Charts'
import { Progress } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { TagLinks } from '../../components/TagFilter'
import { useUI } from '../../context'
import { useFormat } from '../../hooks'
import { scopedHref } from '../../navigation'
import './ProjectCard.css'

/** Días de la minigráfica de commits. */
const DAYS = 30

/** Lado de la portada, en píxeles (fijo: la tarjeta no salta al cargar la imagen). */
const COVER = 48

const SOURCE_ICON: Record<ProjectActivitySource, IconName> = { code: 'git', change: 'edit', item: 'checkCircle' }

/** La portada del juego o, sin ella (o si no carga), su inicial sobre su color. */
export function ProjectCover({ project }: { project: Project }) {
  const [failed, setFailed] = useState<string | null>(null)
  const url = project.coverUrl?.trim()
  if (url && failed !== url)
    return (
      <img
        className="project-cover"
        src={url}
        alt={t('secciones.proyectos.card.cover', { name: project.name })}
        width={COVER}
        height={COVER}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(url)}
      />
    )
  const initial = [...project.name.trim()][0]?.toLocaleUpperCase('es') ?? '?'
  return (
    <span className="project-cover project-cover-initial" aria-hidden="true">
      {initial}
    </span>
  )
}

/** El porcentaje con su método; sin datos suficientes se dice (nunca un 0 %). */
export function ProjectProgressBlock({ progress, name }: { progress: ProjectProgress; name: string }) {
  const method = t(`secciones.proyectos.progress.method.${progress.method}`)
  const pct = progress.ratio === null ? null : Math.round(progress.ratio * 100)
  return (
    <div className="project-progress" title={t(`secciones.proyectos.progress.methodHint.${progress.method}`)}>
      <div className="project-progress-head">
        <span className="project-card-label">
          {t('secciones.proyectos.progress.title')} <span className="project-progress-method">· {method}</span>
        </span>
        {pct === null ? (
          <span className="project-progress-none">
            <Icon name="circleDashed" size={12} /> {t('secciones.proyectos.progress.insufficient')}
          </span>
        ) : (
          <strong className="num">{t('secciones.proyectos.progress.pct', { n: pct })}</strong>
        )}
      </div>
      {pct !== null && (
        <Progress
          ratio={progress.ratio!}
          tone={pct === 100 ? 'success' : 'info'}
          label={t('secciones.proyectos.progress.label', { name, method })}
        />
      )}
      <p className="project-progress-detail">
        {pct === null
          ? t(`secciones.proyectos.progress.insufficientHint.${progress.method}`, { min: progress.minimum, n: progress.total })
          : t(`secciones.proyectos.progress.of.${progress.method}`, { done: progress.done, total: progress.total })}
      </p>
    </div>
  )
}

/** `showOpen` false: sin el acceso a la ficha (cuando ya se está en ella). */
export function ProjectCard({ summary, data, today, showOpen = true }: { summary: ProjectSummary; data: StudioData; today: string; showOpen?: boolean }) {
  const fmt = useFormat()
  const { edit } = useUI()
  const nameId = useId()
  const p = summary.project
  const year = yearOf(today)
  const progress = projectProgress(data, p)
  const next = projectNextMilestone(data, p.id)
  const last = projectLastActivity(data, p.id, today)
  const engine = p.engine?.trim() ? [p.engine.trim(), p.engineVersion?.trim()].filter(Boolean).join(' ') : undefined
  const facts = [p.genre?.trim(), engine].filter(Boolean).join(' · ')
  const here = { scope: p.id, projectSlug: p.slug }
  const late = !!next?.date && next.date < today
  return (
    <article className="project-card" style={{ ['--project-color' as string]: p.color }} aria-labelledby={nameId}>
      <header className="project-card-head">
        <ProjectCover project={p} />
        <div className="project-card-title">
          <h3 id={nameId}>
            <Link to={`/proyectos/${p.slug}`} className="project-name">
              {p.name}
            </Link>
          </h3>
          {facts && <p className="project-card-facts">{facts}</p>}
        </div>
      </header>
      <div className="pills">
        <HealthPill level={summary.health.level} />
        <StagePill stage={p.stage} />
      </div>
      {(p.nextGoal || p.tagline) && <p className="project-goal">{p.nextGoal ?? p.tagline}</p>}
      {p.versions.length > 0 && (
        <div className="versions">
          {p.versions.map((v) => (
            <span key={v.label} className="version" title={v.note}>
              {v.label} <strong>{v.version}</strong>
            </span>
          ))}
        </div>
      )}

      <ProjectProgressBlock progress={progress} name={p.name} />

      <div className="project-milestone">
        <span className="project-card-label">
          <Icon name="flag" size={12} /> {t('secciones.proyectos.card.nextMilestone')}
        </span>
        {next ? (
          <>
            <button type="button" className="item-title" onClick={() => edit({ collection: 'items', id: next.item.id })}>
              {next.item.title}
            </button>
            <span className="item-meta">
              <span className="meta-date">{next.date ? fmt.date(next.date, year) : t('secciones.proyectos.card.noDate')}</span>
              {!next.confirmed && (
                <Pill tone="warning" icon="question">
                  {t('secciones.proyectos.card.unconfirmed')}
                </Pill>
              )}
              {late && (
                <Pill tone="danger" icon="clock">
                  {t('secciones.proyectos.card.late')}
                </Pill>
              )}
            </span>
          </>
        ) : (
          <span className="muted small">{t('secciones.proyectos.card.noMilestone')}</span>
        )}
      </div>

      <div className="project-work">
        <dl className="project-counts" aria-label={t('secciones.proyectos.card.countsLabel', { name: p.name })}>
          <div>
            <dt>{t('secciones.proyectos.card.open')}</dt>
            {/* Las mismas «abiertas» que la barra lateral, la ficha y Estadísticas. */}
            <dd>{summary.open}</dd>
          </div>
          <div>
            <dt>{t('secciones.proyectos.card.toConfirm')}</dt>
            <dd className={summary.toConfirm ? 'text-warning' : undefined}>{summary.toConfirm}</dd>
          </div>
          <div>
            <dt>{t('secciones.proyectos.card.done')}</dt>
            <dd>{summary.done}</dd>
          </div>
        </dl>
        {summary.blocked > 0 ? (
          <Link to={scopedHref('/tareas?filtro=bloqueadas', here)} className="project-blocked" title={t('secciones.proyectos.card.blockedLink', { name: p.name })}>
            <Pill tone="danger" icon="lock">
              {summary.blocked === 1 ? t('secciones.proyectos.card.blockedOne') : t('secciones.proyectos.card.blockedOther', { n: summary.blocked })}
            </Pill>
          </Link>
        ) : (
          summary.open > 0 && (
            <Pill tone="neutral" icon="check">
              {t('secciones.proyectos.card.noneBlocked')}
            </Pill>
          )
        )}
      </div>

      <TagLinks tags={p.tags} />
      <footer>
        <div className="project-card-activity">
          {last ? (
            <>
              <span className="small">
                <Icon name={SOURCE_ICON[last.source]} size={12} />{' '}
                {t('secciones.proyectos.card.lastActivity', { when: fmt.relative(last.date, today) })} · {t(`secciones.proyectos.card.activityFrom.${last.source}`)}
              </span>
              <span className="project-card-last" title={last.title}>
                {t('secciones.proyectos.card.activityTitle', { title: last.title })}
              </span>
            </>
          ) : (
            <span className="muted small">{t('secciones.proyectos.card.noActivity')}</span>
          )}
        </div>
        <Sparkline
          values={dailyCommits(data, today, DAYS, p.id)}
          label={t('secciones.proyectos.card.commits', { n: DAYS })}
          startLabel={fmt.date(addDays(today, -(DAYS - 1)))}
        />
      </footer>
      {showOpen && (
        <Link to={`/proyectos/${p.slug}`} className="btn btn-small project-card-open" aria-label={t('secciones.proyectos.card.openProjectLabel', { name: p.name })}>
          {t('secciones.proyectos.card.openProject')} <Icon name="chevronRight" size={14} />
        </Link>
      )}
    </article>
  )
}
