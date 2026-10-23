// Roadmap › Línea temporal: por proyecto, fases, hitos, versiones y eventos en orden, con
// la marca de hoy entre lo pasado y lo que viene. Es una lista ordenada (se lee igual con
// lector de pantalla); en todo el estudio, una por proyecto.
import { STAGES, type Tone } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { roadmapLine, type RoadmapLine, type RoadmapLineEntry, type RoadmapLineKind } from '../../../domain/selectors'
import { t } from '../../../i18n'
import { useStudioData } from '../../../data/store'
import { Pill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import type { IconName } from '../../components/Icon'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { UnconfirmedPill, useShowMore } from './comunes'

/** Cuánto de lo pasado se ve de entrada (lo más reciente). */
const PAST_LIMIT = 5

const KIND: Record<RoadmapLineKind, { tone: Tone; icon: IconName }> = {
  phase: { tone: 'info', icon: 'layers' },
  milestone: { tone: 'special', icon: 'flag' },
  release: { tone: 'success', icon: 'rocket' },
  event: { tone: 'neutral', icon: 'ticket' },
}

function LineRow({ e, past }: { e: RoadmapLineEntry; past?: boolean }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const today = useToday()
  const year = yearOf(today)
  const title = e.kind === 'phase' && !e.title && e.stage ? STAGES[e.stage].label : e.title
  // Ya empezó y no ha acabado (una fase en curso, una feria de varios días).
  const ongoing = !past && !e.done && !!e.date && e.date <= today
  return (
    <li className={`roadmap-line-entry roadmap-kind-${e.kind}${past ? ' past' : ''}${e.done ? ' done' : ''}`}>
      <span className="roadmap-line-date">
        {e.date ? fmt.date(e.date, year) : t('secciones.roadmap.common.noDate')}
        {e.endDate && <span className="muted small"> {t('secciones.roadmap.linea.until', { date: fmt.date(e.endDate, year) })}</span>}
      </span>
      <div className="roadmap-line-main">
        <button type="button" className="item-title" onClick={() => edit(e.target)}>
          {title}
        </button>
        <div className="item-meta">
          <Pill tone={KIND[e.kind].tone} icon={KIND[e.kind].icon}>
            {t(`secciones.roadmap.linea.kinds.${e.kind}`)}
          </Pill>
          {e.kind === 'phase' && e.title && e.stage && <span className="meta-date">{STAGES[e.stage].label}</span>}
          {e.done && (
            <Pill tone="success" icon="check">
              {t('secciones.roadmap.linea.done')}
            </Pill>
          )}
          {ongoing && (
            <Pill tone="info" icon="play">
              {t('secciones.roadmap.linea.ongoing')}
            </Pill>
          )}
          {past && !e.done && (
            <Pill tone="warning" icon="clock" title={t('secciones.roadmap.linea.openHint')}>
              {t('secciones.roadmap.linea.open')}
            </Pill>
          )}
          {!e.confirmed && !e.done && e.date && <UnconfirmedPill />}
        </div>
      </div>
    </li>
  )
}

function LineCard({ line, title, who }: { line: RoadmapLine; title: string; who: string }) {
  const fmt = useFormat()
  const today = useToday()
  const tag = useTagFilter()
  // Lo pasado, del más reciente hacia atrás, para enseñar primero lo último.
  const past = useShowMore([...line.past].reverse(), PAST_LIMIT)
  const empty = line.past.length + line.future.length + line.undated.length === 0
  return (
    <Card title={title} icon="activity" subtitle={t('secciones.roadmap.linea.subtitle')}>
      {empty ? (
        <Empty icon="activity">{tag ? t('secciones.roadmap.linea.emptyTagged') : t('secciones.roadmap.linea.empty')}</Empty>
      ) : (
        <>
          {past.toggle && <div>{past.toggle}</div>}
          <ol className="roadmap-line" aria-label={t('secciones.roadmap.linea.listOf', { project: who })}>
            {[...past.shown].reverse().map((e) => (
              <LineRow key={e.id} e={e} past />
            ))}
            <li className="roadmap-line-today">
              <span>{t('secciones.roadmap.linea.today', { date: fmt.date(today) })}</span>
            </li>
            {line.future.map((e) => (
              <LineRow key={e.id} e={e} />
            ))}
            {line.future.length === 0 && <li className="roadmap-line-none muted small">{t('secciones.roadmap.linea.nothingAhead')}</li>}
          </ol>
          {line.undated.length > 0 && (
            <>
              <h3 className="subhead">{t('secciones.roadmap.linea.undated')}</h3>
              <ul className="roadmap-line roadmap-line-undated">
                {line.undated.map((e) => (
                  <LineRow key={e.id} e={e} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Card>
  )
}

export function RoadmapLinea() {
  const data = useStudioData()
  const { scope } = useScope()
  const today = useToday()
  const tag = useTagFilter()
  const lines = roadmapLine(data, today, scope, tag)
  const who = (l: RoadmapLine) => (l.projectId ? (data.projects.find((p) => p.id === l.projectId)?.name ?? l.projectId) : t('secciones.roadmap.linea.studio'))
  if (lines.length === 0)
    return (
      <Card>
        <Empty icon="folder">{t('secciones.roadmap.fases.noProjects')}</Empty>
      </Card>
    )
  return (
    <>
      {lines.map((l) => (
        <LineCard key={l.projectId ?? 'estudio'} line={l} who={who(l)} title={scope !== null ? t('secciones.roadmap.linea.title') : who(l)} />
      ))}
    </>
  )
}
