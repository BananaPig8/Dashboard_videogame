// Ajustes › Categorías y etiquetas: las áreas de trabajo (se crean y editan con el editor
// común) y las etiquetas del estudio, con cuántas veces se usan y dónde. Una etiqueta se
// renombra o se fusiona con otra en todas las colecciones a la vez, tras confirmarlo.
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { allTags, cleanTag, normalize, settingsAreaUsage, tagRenamePlan, type TagUse } from '../../../domain/selectors'
import type { Area } from '../../../domain/types'
import { t, tr } from '../../../i18n'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { AreaTag } from '../../components/Badges'
import { Card, Empty, Field, Modal } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { RecordTable } from '../../components/RecordTable'
import { useScope, useUI } from '../../context'
import { useNotify, useUndoable } from '../../feedback'
import { useFormat } from '../../hooks'
import { tagPath } from '../../navigation'
import { countsText, joinList } from './comunes'

export function AjustesCategorias() {
  return (
    <div className="grid grid-2 ajustes-grid">
      <Areas />
      <Etiquetas />
    </div>
  )
}

function Areas() {
  const data = useStudioData()
  const canEdit = useCanEdit()
  const { create, edit } = useUI()
  const usage = settingsAreaUsage(data)
  const areas = [...data.areas].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const newArea = () => create('areas')
  return (
    <Card
      title={t('secciones.ajustes.categorias.areas')}
      icon="list"
      subtitle={t('secciones.ajustes.categorias.areasHint')}
      action={
        canEdit && (
          <button type="button" className="btn btn-small" onClick={newArea}>
            <Icon name="plus" size={14} /> {t('secciones.ajustes.categorias.newArea')}
          </button>
        )
      }
    >
      {areas.length === 0 ? (
        <Empty icon="list" action={canEdit ? { label: t('secciones.ajustes.categorias.newArea'), onClick: newArea } : undefined}>
          {t('secciones.ajustes.categorias.areasEmpty')}
        </Empty>
      ) : (
        <ul className="ajustes-areas">
          {areas.map((a: Area) => {
            const u = usage[a.id]
            const uses = countsText({ items: u.items, members: u.members, activity: u.activity })
            return (
              <li key={a.id}>
                <button
                  type="button"
                  className="link-btn ajustes-area-name"
                  onClick={() => edit({ collection: 'areas', id: a.id })}
                  aria-label={t('secciones.ajustes.categorias.editArea', { name: a.name })}
                >
                  <AreaTag area={a} />
                </button>
                {a.description && <span className="small">{a.description}</span>}
                <span className="muted small">{uses || t('secciones.ajustes.categorias.unused')}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** Cuántas etiquetas se enseñan sin buscar (las más usadas). */
const TAG_LIMIT = 25

function Etiquetas() {
  const data = useStudioData()
  const canEdit = useCanEdit()
  const { scope, project, href } = useScope()
  const fmt = useFormat()
  const [renaming, setRenaming] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const tags = allTags(data, scope)
  const q = normalize(cleanTag(query))
  const matching = q ? tags.filter((u) => normalize(u.tag).includes(q)) : tags
  // Sin buscar, las más usadas (puede haber cientos); buscando, todas las que coinciden.
  const limited = !q && !showAll && matching.length > TAG_LIMIT
  const rows = (limited ? matching.slice(0, TAG_LIMIT) : matching).map((u) => ({ ...u, id: u.tag }))
  return (
    <Card className="ajustes-tags" title={t('secciones.ajustes.categorias.tags')} icon="tag" subtitle={t('secciones.ajustes.categorias.tagsHint')}>
      {project && (
        <p className="ajustes-note">
          <Icon name="folder" size={16} />
          <span>
            {t('secciones.ajustes.categorias.scoped', { project: project.name })}{' '}
            <Link to="/ajustes?seccion=categorias">{t('secciones.ajustes.categorias.seeAll')}</Link>
          </span>
        </p>
      )}
      {tags.length > 0 && (
        <div className="ajustes-tag-tools">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('secciones.ajustes.categorias.searchPlaceholder')}
            aria-label={t('secciones.ajustes.categorias.search')}
          />
          <span className="muted small" role="status">
            {limited
              ? t('secciones.ajustes.categorias.shownTop', { n: TAG_LIMIT, total: fmt.number(tags.length) })
              : t('secciones.ajustes.categorias.shown', { n: fmt.number(rows.length), total: fmt.number(tags.length) })}
          </span>
        </div>
      )}
      <RecordTable<TagUse & { id: string }>
        rows={rows}
        caption={t('secciones.ajustes.categorias.caption')}
        title={(u) => (
          <Link to={href(tagPath(u.tag))} className="tag-link">
            #{u.tag}
          </Link>
        )}
        empty={
          q
            ? t('secciones.ajustes.categorias.noMatch', { q: query.trim() })
            : project
              ? t('secciones.ajustes.categorias.tagsEmptyScoped', { project: project.name })
              : t('secciones.ajustes.categorias.tagsEmpty')
        }
        columns={[
          { key: 'uses', label: t('secciones.ajustes.categorias.colUses'), numeric: true, render: (u) => fmt.number(u.count) },
          {
            key: 'where',
            label: t('secciones.ajustes.categorias.colWhere'),
            render: (u) => <span className="small">{joinList(u.collections.map((k) => tr(`collectionNames.${k}.other`)))}</span>,
          },
          ...(canEdit
            ? [
                {
                  key: 'actions',
                  label: t('secciones.ajustes.categorias.colActions'),
                  render: (u: TagUse) => (
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      onClick={() => setRenaming(u.tag)}
                      aria-label={t('secciones.ajustes.categorias.renameLabel', { tag: u.tag })}
                    >
                      <Icon name="edit" size={14} /> {t('secciones.ajustes.categorias.rename')}
                    </button>
                  ),
                },
              ]
            : []),
        ]}
      />
      {!q && matching.length > TAG_LIMIT && (
        <button type="button" className="btn btn-small btn-ghost ajustes-more" onClick={() => setShowAll(!showAll)}>
          {showAll
            ? t('secciones.ajustes.categorias.showTop', { n: TAG_LIMIT })
            : t('secciones.ajustes.categorias.showAll', { n: fmt.number(matching.length) })}
        </button>
      )}
      {renaming && <RenameTag tag={renaming} existing={allTags(data).map((u) => u.tag)} onClose={() => setRenaming(null)} />}
    </Card>
  )
}

/** «1 elemento», «3 elementos» (de cualquier colección). */
const elements = (n: number) => t(n === 1 ? 'secciones.ajustes.categorias.element' : 'secciones.ajustes.categorias.elements', { n })

/** Ventana para renombrar una etiqueta (o fusionarla con otra que ya existe). */
function RenameTag({ tag, existing, onClose }: { tag: string; existing: string[]; onClose: () => void }) {
  const data = useStudioData()
  const { confirm } = useNotify()
  const undoable = useUndoable()
  const listId = useId()
  const [value, setValue] = useState(tag)
  const [touched, setTouched] = useState(false)
  const plan = tagRenamePlan(data, tag, value)
  const problem = plan.problem && touched ? t(`secciones.ajustes.categorias.problems.${plan.problem}`) : undefined
  const count = elements(plan.affected)
  const consequence = plan.problem
    ? undefined
    : plan.merge
      ? t('secciones.ajustes.categorias.willMerge', { target: plan.target, tag })
      : t('secciones.ajustes.categorias.willRename', { count })

  const submit = async () => {
    setTouched(true)
    if (plan.problem) return
    onClose()
    const vars = { tag, target: plan.target, count, already: elements(plan.alreadyTarget) }
    const ok = await confirm(
      plan.merge
        ? {
            title: t('secciones.ajustes.categorias.confirmMergeTitle', vars),
            message: plan.alreadyTarget
              ? t('secciones.ajustes.categorias.confirmMergeBody', vars)
              : t('secciones.ajustes.categorias.confirmMergeBodyNoOthers', vars),
            confirmLabel: t('secciones.ajustes.categorias.confirmMergeOk'),
            danger: true,
          }
        : {
            title: t('secciones.ajustes.categorias.confirmRenameTitle', vars),
            message: t('secciones.ajustes.categorias.confirmRenameBody', vars),
            confirmLabel: t('secciones.ajustes.categorias.confirmRenameOk'),
          },
    )
    if (!ok) return
    undoable(plan.merge ? t('secciones.ajustes.categorias.merged', vars) : t('secciones.ajustes.categorias.renamed', vars), () => store.renameTag(tag, plan.target))
  }

  return (
    <Modal
      open
      small
      title={t('secciones.ajustes.categorias.renameTitle', { tag })}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {t('actions.cancel')}
          </button>
          <button type="submit" form={`${listId}-form`} className="btn btn-primary">
            {t('secciones.ajustes.categorias.rename')}
          </button>
        </>
      }
    >
      <form
        id={`${listId}-form`}
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field label={t('secciones.ajustes.categorias.newName')} hint={t('secciones.ajustes.categorias.renameHint')} error={problem} id={`${listId}-input`}>
          <input
            id={`${listId}-input`}
            value={value}
            list={listId}
            autoFocus
            aria-invalid={!!problem || undefined}
            aria-describedby={problem ? `${listId}-input-error` : undefined}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <datalist id={listId}>
          {existing
            .filter((x) => x !== tag)
            .map((x) => (
              <option key={x} value={x} />
            ))}
        </datalist>
        {consequence && (
          <p className={plan.merge ? 'ajustes-note ajustes-note-warning' : 'ajustes-note'} role="status">
            <Icon name={plan.merge ? 'alert' : 'info'} size={16} />
            <span>{consequence}</span>
          </p>
        )}
      </form>
    </Modal>
  )
}
