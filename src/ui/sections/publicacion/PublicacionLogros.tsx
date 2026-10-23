// Logros: cada logro con su estado (idea, diseñado, en el juego, dado de alta en la tienda),
// si es oculto, su nombre interno y la fiabilidad del dato. Lo de la tienda se apunta a mano.
import { achievementCounts, achievementsOf, hasTag } from '../../../domain/selectors'
import type { Achievement } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ConfidenceTag, Pill, ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { RecordTable, type Column } from '../../components/RecordTable'
import { TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import type { SectionPageProps } from '../registry'
import { AchievementStatusPill, ManualNotice, NewButton, PublicacionPage } from './comunes'

export function PublicacionLogros({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const all = achievementsOf(data, scope)
  const list = all.filter((a) => hasTag(a, tag))
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  const L = (k: 'status' | 'how' | 'hidden' | 'api' | 'confidence' | 'project' | 'tags') => t(`secciones.publicacion.logros.table.${k}`)
  const columns: Column<Achievement>[] = [
    { key: 'status', label: L('status'), render: (a) => <AchievementStatusPill status={a.status} /> },
    {
      key: 'how',
      label: L('how'),
      render: (a) =>
        a.description ? <span className="publicacion-how">{a.description}</span> : <span className="muted">{t('secciones.publicacion.logros.noHow')}</span>,
    },
    {
      key: 'hidden',
      label: L('hidden'),
      render: (a) =>
        a.hidden ? (
          <Pill tone="special" icon="lock">
            {t('secciones.publicacion.logros.hidden')}
          </Pill>
        ) : (
          <Pill tone="neutral" icon="eye">
            {t('secciones.publicacion.logros.visible')}
          </Pill>
        ),
    },
    {
      key: 'api',
      label: L('api'),
      render: (a) => (a.apiName ? <code>{a.apiName}</code> : <span className="muted">{t('secciones.publicacion.logros.noApi')}</span>),
    },
    { key: 'confidence', label: L('confidence'), render: (a) => <ConfidenceTag confidence={a.confidence} /> },
    ...(scope === null ? [{ key: 'project', label: L('project'), render: (a: Achievement) => <ProjectChip project={projects.get(a.projectId)} /> }] : []),
    ...(list.some((a) => a.tags?.length)
      ? [
          {
            key: 'tags',
            label: L('tags'),
            render: (a: Achievement) =>
              a.tags?.length ? <TagLinks tags={a.tags} /> : <span className="muted">{t('secciones.publicacion.logros.noTags')}</span>,
          },
        ]
      : []),
  ]
  return (
    <PublicacionPage embedded={embedded} actions={<NewButton collection="achievements" label={t('secciones.publicacion.actions.newAchievement')} primary />}>
      <ManualNotice kind="achievements" />
      <Card
        title={t('secciones.publicacion.logros.caption')}
        icon="trophy"
        subtitle={
          list.length ? (
            <span className="publicacion-counts">
              {achievementCounts(list).map((c) => (
                <span key={c.status} className="publicacion-count">
                  <AchievementStatusPill status={c.status} /> {c.count}
                </span>
              ))}
            </span>
          ) : undefined
        }
      >
        {list.length ? (
          <RecordTable
            rows={list}
            columns={columns}
            caption={t('secciones.publicacion.logros.caption')}
            title={(a) => a.name}
            onOpen={(a) => edit({ collection: 'achievements', id: a.id })}
          />
        ) : (
          <Empty
            icon="trophy"
            action={canEdit && !tag ? { label: t('secciones.publicacion.actions.newAchievement'), onClick: () => create('achievements') } : undefined}
          >
            {tag && all.length ? t('secciones.publicacion.logros.emptyTag') : t('secciones.publicacion.logros.empty')}
          </Empty>
        )}
      </Card>
    </PublicacionPage>
  )
}
