// Lanzamientos: lo que falta para publicar, por proyecto y por categoría (lanzamiento, demos,
// builds candidatas, materiales, logros, revisiones de tienda, actualizaciones y DLC). Todo sale
// de lo registrado (domain/secciones/panel-lanzamientos.ts); cada línea abre el elemento o
// lleva a su sección con el ámbito.
import { Link } from 'react-router-dom'
import { buildLabel, launchPanel, releaseLabel, type LaunchCategory, type LaunchCategoryId, type LaunchLine, type LaunchProject } from '../../../../domain/selectors'
import type { ChecklistTarget, ID } from '../../../../domain/types'
import { intlLocale, t, type MessageKey } from '../../../../i18n'
import { useCanEdit } from '../../../../data/store'
import { BuildChannelPill, BuildStatusPill, Pill, ProjectChip } from '../../../components/Badges'
import { Empty, Progress } from '../../../components/Common'
import { Icon, type IconName } from '../../../components/Icon'
import { useScope, useUI } from '../../../context'
import { useFormat } from '../../../hooks'
import { scopedHref } from '../../../navigation'
import { ListingStatusPill, ReleaseStatusPill, ReleaseWhen, listingName } from '../../publicacion/comunes'
import { ScopedMore, type WidgetProps } from './comunes'
import './lanzamientos.css'

/** Líneas que enseña cada categoría fuera del modo foco (el resto, en su sección). */
const LINES = 3

const CATEGORY: Record<LaunchCategoryId, { icon: IconName; to: string }> = {
  launches: { icon: 'rocket', to: '/publicacion?vista=lanzamiento' },
  demos: { icon: 'play', to: '/publicacion?vista=estado' },
  candidates: { icon: 'box', to: '/builds?canal=candidatas' },
  materials: { icon: 'list', to: '/publicacion?vista=lanzamiento' },
  achievements: { icon: 'trophy', to: '/publicacion?vista=logros' },
  reviews: { icon: 'eye', to: '/publicacion?vista=estado' },
  updates: { icon: 'download', to: '/publicacion?vista=dlc' },
  dlc: { icon: 'layers', to: '/publicacion?vista=dlc' },
}

/** Dónde se ven los pasos de cada lista (las de Steam, en Preparación de Steam). */
const CHECKLIST_VIEW: Partial<Record<ChecklistTarget, string>> = { steam: '/publicacion' }

type Vars = Record<string, string | number>
const P = 'secciones.panel.tarjetas.lanzamientos'
type LKey = MessageKey extends infer K ? (K extends `${typeof P}.${infer R}` ? R : never) : never
/** Un texto de este bloque (la clave se comprueba al compilar). */
const L = (k: LKey, vars?: Vars) => t(`${P}.${k}`, vars)
const C = (id: LaunchCategoryId, k: 'title' | 'short' | 'none' | 'clear', vars?: Vars) => L(`categories.${id}.${k}`, vars)
/** «1 pendiente» / «3 pendientes». */
const count = (n: number, one: LKey, other: LKey) => (n === 1 ? L(one, { n }) : L(other, { n }))

/** Un enlace a una sección para un proyecto: en su ficha, a su pestaña; en el estudio, con ?p=. */
function useLinkFor() {
  const { href, scope } = useScope()
  return (to: string, projectId: ID) => (scope ? href(to) : scopedHref(to, { scope: projectId }))
}

function Line({ line, projectId }: { line: LaunchLine; projectId: ID }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const linkFor = useLinkFor()
  switch (line.kind) {
    case 'release': {
      const r = line.release
      return (
        <li className="launch-line">
          <button type="button" className="item-title" onClick={() => edit({ collection: 'releases', id: r.id })}>
            {releaseLabel(r)}
          </button>
          <div className="item-meta">
            <ReleaseStatusPill status={r.status} />
            <ReleaseWhen release={r} />
            {line.builds.map((b) => (
              <button key={b.id} type="button" className="link-btn meta-date" onClick={() => edit({ collection: 'builds', id: b.id })}>
                {L('line.buildIn', { name: buildLabel(b) })}
              </button>
            ))}
          </div>
        </li>
      )
    }
    case 'build': {
      const b = line.build
      return (
        <li className="launch-line">
          <button type="button" className="item-title" onClick={() => edit({ collection: 'builds', id: b.id })}>
            {buildLabel(b)}
          </button>
          <div className="item-meta">
            <BuildChannelPill channel={b.channel} />
            <BuildStatusPill status={b.status} />
            {b.date && <span className="meta-date">{fmt.date(b.date)}</span>}
          </div>
        </li>
      )
    }
    case 'checklist': {
      const n = line.pending.length
      const vars = { n, done: line.done, total: line.total }
      return (
        <li className="launch-line">
          <Link to={linkFor(CHECKLIST_VIEW[line.checklist.target] ?? '/publicacion?vista=lanzamiento', projectId)} className="item-title">
            {line.checklist.title}
          </Link>
          <Progress ratio={line.total ? line.done / line.total : 0} tone="info" label={line.checklist.title} />
          <div className="item-meta">
            <span className="meta-date">{n === 1 ? L('line.stepsOne', vars) : L('line.stepsOther', vars)}</span>
            <span className="meta-date">{L('line.nextStep', { label: line.pending[0].label })}</span>
          </div>
        </li>
      )
    }
    case 'texts': {
      const listing = line.listing ? listingName(line.listing) : L('line.textsOrphan')
      const n = line.texts.length
      return (
        <li className="launch-line">
          <Link to={linkFor('/publicacion?vista=descripciones', projectId)} className="item-title">
            {n === 1 ? L('line.textsOne', { listing }) : L('line.textsOther', { listing, n })}
          </Link>
        </li>
      )
    }
    case 'achievements': {
      const n = line.achievements.length
      const verify = line.reason === 'verify'
      // Lo que les falta de verdad: verificarlos, decidir si son ocultos o las dos cosas (unos una y otros otra).
      const title = !verify
        ? count(n, 'line.implementOne', 'line.implementOther')
        : line.undecided === 0
          ? count(n, 'line.verifyOne', 'line.verifyOther')
          : line.unverified === 0
            ? count(n, 'line.decideOne', 'line.decideOther')
            : count(n, 'line.reviewOne', 'line.reviewOther')
      const both = line.undecided > 0 && line.unverified > 0
      return (
        <li className="launch-line">
          <Link to={linkFor('/publicacion?vista=logros', projectId)} className="item-title">
            {title}
          </Link>
          <div className="item-meta">
            {verify ? (
              both && (
                <>
                  <Pill tone="warning" icon="question">
                    {L('line.undecided', { n: line.undecided })}
                  </Pill>
                  <Pill tone="warning" icon="question">
                    {L('line.unverified', { n: line.unverified })}
                  </Pill>
                </>
              )
            ) : (
              <span className="meta-date">{L('line.implementHint')}</span>
            )}
          </div>
        </li>
      )
    }
    case 'listing':
      return (
        <li className="launch-line">
          <button type="button" className="item-title" onClick={() => edit({ collection: 'storeListings', id: line.listing.id })}>
            {listingName(line.listing)}
          </button>
          <div className="item-meta">
            <ListingStatusPill status={line.listing.status} />
          </div>
        </li>
      )
  }
}

/** Una categoría: su nombre (enlace a su sección), cuánto falta y lo pendiente. */
function Category({ category: c, projectId, focus }: { category: LaunchCategory; projectId: ID; focus?: boolean }) {
  const linkFor = useLinkFor()
  const shown = focus ? c.lines : c.lines.slice(0, LINES)
  const to = linkFor(CATEGORY[c.id].to, projectId)
  return (
    <li className="launch-cat">
      <div className="launch-cat-head">
        <Icon name={CATEGORY[c.id].icon} size={16} />
        <Link to={to} className="launch-cat-title">
          {C(c.id, 'title')}
        </Link>
        {c.registered === 0 ? (
          <span className="launch-cat-state muted">
            <Icon name="circleDashed" size={12} /> {C(c.id, 'none')}
          </span>
        ) : c.pending === 0 ? (
          <span className="launch-cat-state launch-cat-clear">
            <Icon name="checkCircle" size={12} /> {C(c.id, 'clear', { done: c.done, total: c.total })}
          </span>
        ) : (
          <span className="launch-cat-state">{count(c.pending, 'pendingOne', 'pendingOther')}</span>
        )}
      </div>
      {shown.length > 0 && (
        <ul className="launch-lines">
          {shown.map((line) => (
            <Line key={line.id} line={line} projectId={projectId} />
          ))}
        </ul>
      )}
      {c.lines.length > shown.length && (
        <Link to={to} className="launch-more">
          {L('more', { n: c.lines.length - shown.length })} <Icon name="chevronRight" size={12} />
        </Link>
      )}
    </li>
  )
}

/**
 * Las categorías de un proyecto. En el modo foco, cada una en su fila (también las que no tienen
 * nada registrado, diciéndolo); fuera de él, esas se juntan en una línea al final.
 */
function ProjectLaunch({ lp, focus }: { lp: LaunchProject; focus?: boolean }) {
  const empty = lp.categories.filter((c) => c.registered === 0)
  const shown = focus ? lp.categories : lp.categories.filter((c) => c.registered > 0)
  return (
    <>
      <ul className="launch-cats">
        {shown.map((c) => (
          <Category key={c.id} category={c} projectId={lp.project.id} focus={focus} />
        ))}
      </ul>
      {!focus && empty.length > 0 && (
        <p className="launch-none muted small">
          <Icon name="circleDashed" size={12} />{' '}
          {L('noneGroup', { names: new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(empty.map((c) => C(c.id, 'short'))) })}
        </p>
      )}
    </>
  )
}

export function ReleasesBody({ data, scope, focus }: WidgetProps) {
  const { create } = useUI()
  const canEdit = useCanEdit()
  const projects = launchPanel(data, scope)
  const withData = projects.filter((p) => p.registered > 0)
  const without = projects.filter((p) => p.registered === 0)
  const action = canEdit ? { label: L('addChecklist'), onClick: () => create('checklists', { target: 'steam' }) } : undefined

  if (projects.length === 0 || withData.length === 0)
    return (
      <Empty icon="rocket" action={action}>
        {L('nothingAtAll')}
      </Empty>
    )

  // Un proyecto (el del ámbito o el único con datos): sus categorías, sin cabecera.
  const single = scope !== null || withData.length === 1
  return (
    <div className="launch">
      {single ? (
        <ProjectLaunch lp={withData[0]} focus={focus} />
      ) : (
        withData.map((lp) => (
          <section key={lp.project.id} className="launch-project" aria-label={L('projectLabel', { name: lp.project.name })}>
            <h3 className="launch-project-head">
              <ProjectChip project={lp.project} />
              <span className="launch-cat-state">{lp.pending ? count(lp.pending, 'projectPendingOne', 'projectPendingOther') : L('projectClear')}</span>
            </h3>
            <ProjectLaunch lp={lp} focus={focus} />
          </section>
        ))
      )}
      {scope === null && without.length > 0 && (
        <p className="launch-none muted small">
          {L('withoutData', { names: new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(without.map((p) => p.project.name)) })}
        </p>
      )}
      <p className="launch-manual muted small">
        <Icon name="info" size={12} /> {L('manual')}
      </p>
    </div>
  )
}

export function ReleasesAction() {
  return <ScopedMore to="/publicacion" label={t('secciones.panel.launch.link')} />
}
