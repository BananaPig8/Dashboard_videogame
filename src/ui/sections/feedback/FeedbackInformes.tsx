// Informes de pruebas (vista aparte): cada prueba con jugadores con su fecha, cómo se hizo,
// cuántas personas, la build, el evento, el resumen y el feedback que salió de ella.
import { PLAYTEST_METHODS } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { playtestFeedbackWithoutTest, playtestReports, type PlaytestReport } from '../../../domain/selectors'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ConfidenceTag, ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { FeedbackPage, FeedbackRow } from './comunes'

export function FeedbackInformes({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const reports = playtestReports(data, scope, tag)
  const loose = playtestFeedbackWithoutTest(data, scope, tag)
  const any = tag ? playtestReports(data, scope).length > 0 : reports.length > 0
  const newTest = () => create('playtests')
  return (
    <FeedbackPage
      embedded={embedded}
      action={{ label: t('secciones.feedback.informes.new'), onClick: newTest }}
      intro={<p>{t('secciones.feedback.informes.intro')}</p>}
    >
      {reports.length === 0 ? (
        <Card>
          <Empty icon="users" action={canEdit && !tag ? { label: t('secciones.feedback.informes.new'), onClick: newTest } : undefined}>
            {any ? t('secciones.feedback.informes.emptyTag') : t('secciones.feedback.informes.empty')}
          </Empty>
        </Card>
      ) : (
        reports.map((r) => <Report key={r.playtest.id} report={r} showProject={scope === null} />)
      )}
      {loose.length > 0 && (
        <Card
          title={t('secciones.feedback.informes.loose')}
          icon="question"
          subtitle={t(loose.length === 1 ? 'secciones.feedback.count.one' : 'secciones.feedback.count.many', { n: loose.length })}
        >
          <p className="muted small">{t('secciones.feedback.informes.looseHint')}</p>
          <ul className="item-list">
            {loose.map((f) => (
              <FeedbackRow key={f.id} feedback={f} showProject={scope === null} compact />
            ))}
          </ul>
        </Card>
      )}
    </FeedbackPage>
  )
}

function Report({ report: r, showProject }: { report: PlaytestReport; showProject: boolean }) {
  const data = useStudioData()
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const p = r.playtest
  const subtitle = [
    p.date ? fmt.date(p.date, year) : t('secciones.feedback.informes.noDate'),
    PLAYTEST_METHODS[p.method],
    p.participants !== undefined
      ? t(p.participants === 1 ? 'secciones.feedback.informes.people.one' : 'secciones.feedback.informes.people.many', { n: p.participants })
      : t('secciones.feedback.informes.people.none'),
  ].join(' · ')
  const addFeedback = () =>
    create('feedback', {
      projectId: p.projectId,
      origin: 'playtest',
      playtestId: p.id,
      ...(p.buildId ? { buildId: p.buildId } : {}),
      ...(p.date ? { receivedAt: p.date } : {}),
    })
  return (
    <Card
      title={p.title}
      icon="users"
      subtitle={subtitle}
      action={
        canEdit ? (
          <button
            type="button"
            className="icon-btn small"
            onClick={() => edit({ collection: 'playtests', id: p.id })}
            aria-label={t('secciones.feedback.informes.edit', { title: p.title })}
            title={t('secciones.feedback.informes.edit', { title: p.title })}
          >
            <Icon name="edit" size={14} />
          </button>
        ) : undefined
      }
    >
      <div className="item-meta">
        {showProject && <ProjectChip project={data.projects.find((x) => x.id === p.projectId)} />}
        <span className="meta-date">
          {t('secciones.feedback.informes.build')}{' '}
          {r.build ? (
            <button type="button" className="link-btn" onClick={() => edit({ collection: 'builds', id: r.build!.id })}>
              {r.build.name} v{r.build.version}
            </button>
          ) : p.buildId ? (
            t('secciones.feedback.informes.missing')
          ) : (
            t('secciones.feedback.informes.noBuild')
          )}
        </span>
        {(r.event || p.eventId) && (
          <span className="meta-date">
            {t('secciones.feedback.informes.event')}{' '}
            {r.event ? (
              <button type="button" className="link-btn" onClick={() => edit({ collection: 'events', id: r.event!.id })}>
                {r.event.title}
              </button>
            ) : (
              t('secciones.feedback.informes.missing')
            )}
          </span>
        )}
        <ConfidenceTag confidence={p.confidence} compact />
        <TagLinks tags={p.tags} />
      </div>
      {p.summary ? <p className="feedback-summary">{p.summary}</p> : <p className="muted small">{t('secciones.feedback.informes.noSummary')}</p>}
      <div className="feedback-report-head">
        <h3 className="subhead">{t('secciones.feedback.informes.feedback', { n: r.feedback.length })}</h3>
        {canEdit && (
          <button type="button" className="btn btn-small btn-ghost" onClick={addFeedback}>
            <Icon name="plus" size={14} /> {t('secciones.feedback.informes.addFeedback')}
          </button>
        )}
      </div>
      {r.feedback.length ? (
        <ul className="item-list">
          {r.feedback.map((f) => (
            <FeedbackRow key={f.id} feedback={f} compact />
          ))}
        </ul>
      ) : (
        <p className="muted small">{t('secciones.feedback.informes.noFeedback')}</p>
      )}
    </Card>
  )
}
