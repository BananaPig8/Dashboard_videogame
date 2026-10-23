// La tarjeta de un proyecto: etapa, salud, objetivo, versiones, cifras de trabajo y la
// actividad de los últimos 30 días. La usan Proyectos, el panel y la ficha.
import { Link } from 'react-router-dom'
import { addDays } from '../../../domain/dates'
import { dailyCommits, type ProjectSummary } from '../../../domain/selectors'
import type { StudioData } from '../../../domain/types'
import { t } from '../../../i18n'
import { HealthPill, StagePill } from '../../components/Badges'
import { Sparkline } from '../../components/Charts'
import { TagLinks } from '../../components/TagFilter'
import { useFormat } from '../../hooks'

/** Días de la minigráfica de commits. */
const DAYS = 30

export function ProjectCard({ summary, data, today }: { summary: ProjectSummary; data: StudioData; today: string }) {
  const fmt = useFormat()
  const p = summary.project
  return (
    <article className="project-card" style={{ ['--project-color' as string]: p.color }}>
      <header>
        <Link to={`/proyectos/${p.slug}`} className="project-name">
          {p.name}
        </Link>
        <div className="pills">
          <StagePill stage={p.stage} />
          <HealthPill level={summary.health.level} />
        </div>
      </header>
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
      <dl className="project-counts">
        <div>
          <dt>{t('secciones.proyectos.card.open')}</dt>
          <dd>{summary.actionable}</dd>
        </div>
        <div>
          <dt>{t('secciones.proyectos.card.blocked')}</dt>
          <dd className={summary.blocked ? 'text-danger' : undefined}>{summary.blocked}</dd>
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
      <TagLinks tags={p.tags} />
      <footer>
        <span className="muted small">
          {summary.lastActivity
            ? t('secciones.proyectos.card.lastActivity', { when: fmt.relative(summary.lastActivity, today) })
            : t('secciones.proyectos.card.noActivity')}
        </span>
        <Sparkline
          values={dailyCommits(data, today, DAYS, p.id)}
          label={t('secciones.proyectos.card.commits', { n: DAYS })}
          startLabel={fmt.date(addDays(today, -(DAYS - 1)))}
        />
      </footer>
    </article>
  )
}
