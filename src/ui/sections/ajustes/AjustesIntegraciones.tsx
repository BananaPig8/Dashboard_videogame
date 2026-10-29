// Ajustes › Integraciones: el registro honesto de lo que hay conectado. Ninguna integración
// está activa salvo la base de datos de la página de claude.ai cuando se usa allí; lo demás
// se lleva a mano (con su fuente) o es un fichero que se descarga. Nada aparenta estar conectado.
import { Link } from 'react-router-dom'
import { CONFIDENCES, type Tone } from '../../../domain/catalog'
import { hostingOf, integrationsStatus, type IntegrationId, type IntegrationInfo, type IntegrationState } from '../../../domain/selectors'
import { t, tr } from '../../../i18n'
import { EN_CLAUDE } from '../../../data/runtime'
import { useStudioData } from '../../../data/store'
import { ConfidenceTag, Pill } from '../../components/Badges'
import { Card } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { useFormat } from '../../hooks'
import { sectionById, type SectionId } from '../../navigation'
import type { Confidence } from '../../../domain/types'
import { countsText, useAjustesHref } from './comunes'

const STATE: Record<IntegrationState, { tone: Tone; icon: IconName }> = {
  active: { tone: 'success', icon: 'checkCircle' },
  local: { tone: 'info', icon: 'box' },
  outside: { tone: 'neutral', icon: 'shield' },
  manual: { tone: 'info', icon: 'git' },
  file: { tone: 'neutral', icon: 'download' },
  off: { tone: 'muted', icon: 'xCircle' },
}

const ICON: Record<IntegrationId, IconName> = {
  storage: 'box',
  hosting: 'shield',
  github: 'git',
  steamworks: 'rocket',
  itch: 'globe',
  discord: 'message',
  talo: 'chart',
  calendar: 'calendar',
  backup: 'download',
}

/** Dónde se lleva cada cosa: [sección, subsección]. */
const WHERE: Partial<Record<IntegrationId, [SectionId, string?]>> = {
  github: ['builds', 'cambios'],
  steamworks: ['publicacion'],
  itch: ['publicacion'],
  discord: ['feedback'],
  talo: ['estadisticas'],
  calendar: ['calendario'],
}

/** El enlace a una sección (o subsección) y su nombre. */
function sectionLink(id: SectionId, child?: string): { to: string; label: string } {
  const s = sectionById(id)
  const c = child ? s.children.find((x) => x.id === child) : undefined
  return c ? { to: c.to, label: `${s.label} › ${c.label}` } : { to: s.to, label: s.label }
}

export function AjustesIntegraciones() {
  const data = useStudioData()
  const list = integrationsStatus(data, EN_CLAUDE)
  return (
    <div className="stack">
      <p className="ajustes-note">
        <Icon name="plug" size={16} />
        <span>{EN_CLAUDE ? t('secciones.ajustes.integraciones.introClaude') : t('secciones.ajustes.integraciones.intro')}</span>
      </p>
      <div className="grid grid-2-1 ajustes-grid">
        <Card title={t('secciones.ajustes.integraciones.card')} icon="plug" subtitle={t('secciones.ajustes.integraciones.cardHint')}>
          <ul className="ajustes-int">
            {list.map((i) => (
              <Integracion key={i.id} info={i} />
            ))}
          </ul>
        </Card>
        <Card title={t('secciones.ajustes.integraciones.reliability')} icon="question" subtitle={t('secciones.ajustes.integraciones.reliabilityHint')}>
          <ul className="legend-list">
            {(Object.keys(CONFIDENCES) as Confidence[]).map((k) => (
              <li key={k}>
                <ConfidenceTag confidence={k} /> {CONFIDENCES[k].hint}
              </li>
            ))}
          </ul>
          <p className="muted small">{t('secciones.ajustes.integraciones.reliabilityBody')}</p>
        </Card>
      </div>
    </div>
  )
}

function Integracion({ info }: { info: IntegrationInfo }) {
  const fmt = useFormat()
  const ajustesHref = useAjustesHref()
  const key = `secciones.ajustes.integraciones.items.${info.id}`
  const state = STATE[info.state]
  const counts = countsText(info.counts)
  const where = WHERE[info.id]
  const link = where ? sectionLink(...where) : info.id === 'backup' ? { to: ajustesHref('datos'), label: tr('nav.children.ajustes.datos') } : undefined
  let body: string
  if (info.id === 'storage') body = tr(`${key}.${EN_CLAUDE ? 'claude' : 'local'}`)
  else if (info.id === 'hosting') body = EN_CLAUDE ? `${tr(`${key}.body`)} ${tr(`${key}.claude`)}` : tr(`${key}.body`)
  else body = tr(`${key}.body`)
  const host = typeof window !== 'undefined' ? window.location.host : ''
  return (
    <li>
      <div className="ajustes-int-head">
        <Icon name={ICON[info.id]} size={16} />
        <h3>{tr(`${key}.name`)}</h3>
        <Pill tone={state.tone} icon={state.icon}>
          {t(`secciones.ajustes.integraciones.states.${info.state}`)}
        </Pill>
      </div>
      <p className="small">{body}</p>
      {info.id === 'hosting' && (
        <p className="muted small">
          {t(`secciones.ajustes.integraciones.hostNow.${hostingOf(window.location.hostname, EN_CLAUDE)}`, { host })}{' '}
          {!EN_CLAUDE && t('secciones.ajustes.integraciones.readme')}
        </p>
      )}
      {info.id === 'github' && (
        <p className="muted small">
          {counts ? `${t('secciones.ajustes.integraciones.imported', { list: counts })} ` : ''}
          {info.lastAt
            ? t('secciones.ajustes.integraciones.lastImport', { date: fmt.date(info.lastAt.slice(0, 10)) })
            : t('secciones.ajustes.integraciones.nothingImported')}
        </p>
      )}
      {info.id !== 'github' && counts && <p className="muted small">{t('secciones.ajustes.integraciones.noted', { list: counts })}</p>}
      {link && (
        <Link to={link.to} className="small ajustes-int-link">
          {t('secciones.ajustes.integraciones.goTo', { section: link.label })} <Icon name="chevronRight" size={12} />
        </Link>
      )}
    </li>
  )
}
