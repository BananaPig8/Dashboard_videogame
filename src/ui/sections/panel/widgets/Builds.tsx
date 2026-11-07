// Builds y versiones: lo último compilado de cada canal (sin sustituidas ni retiradas). El nombre
// abre la build; la versión va con buildLabel (sin repetirla si el nombre ya la lleva).
import { buildLabel, currentBuilds } from '../../../../domain/selectors'
import { t } from '../../../../i18n'
import { useCanEdit } from '../../../../data/store'
import { BuildChannelPill, BuildStatusPill, ConfidenceTag, ProjectChip } from '../../../components/Badges'
import { Empty } from '../../../components/Common'
import { Icon } from '../../../components/Icon'
import { useUI } from '../../../context'
import { type WidgetProps } from './comunes'

export function BuildsBody({ data, scope, year, fmt }: WidgetProps) {
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const builds = currentBuilds(data, scope)
  if (builds.length === 0)
    return (
      <Empty icon="box" action={canEdit ? { label: t('secciones.panel.builds.add'), onClick: () => create('builds') } : undefined}>
        {t('secciones.panel.builds.empty')}
      </Empty>
    )
  return (
    <ul className="build-list">
      {builds.map((b) => (
        <li key={b.id} className="build-row">
          <div>
            <button type="button" className="item-title" onClick={() => edit({ collection: 'builds', id: b.id })}>
              {buildLabel(b)}
            </button>
            <div className="item-meta">
              <BuildChannelPill channel={b.channel} />
              {b.platforms.length > 0 && <span className="meta-date">{b.platforms.join(' · ')}</span>}
              {b.date && <span className="meta-date">{fmt.date(b.date, year)}</span>}
              {!scope && <ProjectChip project={data.projects.find((p) => p.id === b.projectId)} />}
            </div>
          </div>
          <div className="item-side">
            <BuildStatusPill status={b.status} />
            <ConfidenceTag confidence={b.confidence} compact />
            {b.url && (
              <a
                href={b.url}
                target="_blank"
                rel="noreferrer noopener"
                className="icon-btn"
                aria-label={t('secciones.panel.builds.open', { name: buildLabel(b) })}
                title={t('secciones.panel.builds.open', { name: buildLabel(b) })}
              >
                <Icon name="external" size={16} />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
