// Paleta de órdenes (Ctrl/Cmd + K o «/»): ir a cualquier pantalla, proyecto, vista
// guardada o elemento, y crear cosas, sin soltar el teclado.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STATUSES } from '../domain/catalog'
import { matchesQuery, normalize } from '../domain/selectors'
import { t } from '../i18n'
import { useStudioData, type CollectionKey } from '../data/store'
import { Modal } from './components/Common'
import { Icon, type IconName } from './components/Icon'
import { useScope, useUI } from './context'
import { getPreferences, resolvedTheme, updatePreferences, usePreferences } from './prefs'
import { navPages, quickCreate } from './navigation'

interface Command {
  id: string
  group: string
  label: string
  icon: IconName
  meta?: string
  run: () => void
}

export function CommandPalette({ open, initialQuery, onClose }: { open: boolean; initialQuery?: string; onClose: () => void }) {
  const data = useStudioData()
  const prefs = usePreferences()
  const navigate = useNavigate()
  const { create, openItem } = useUI()
  const { scope, href } = useScope()
  const [query, setQuery] = useState(initialQuery ?? '')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open) {
      setQuery(initialQuery ?? '')
      setActive(0)
    }
  }, [open, initialQuery])

  const commands = useMemo<Command[]>(() => {
    const q = normalize(query.trim())
    const match = (text: string) => !q || q.split(/\s+/).every((w) => normalize(text).includes(w))
    const go = (path: string) => () => navigate(path)
    const out: Command[] = []
    for (const a of quickCreate()) {
      const label = `${t('topbar.new')}: ${a.label}`
      if (match(label)) out.push({ id: `new-${a.id}`, group: t('palette.actions'), label, icon: 'plus', run: () => create(a.collection as CollectionKey, a.defaults) })
    }
    const toggle = t('palette.toggleTheme')
    if (match(toggle))
      out.push({
        id: 'theme',
        group: t('palette.actions'),
        label: toggle,
        icon: 'moon',
        run: () => updatePreferences({ theme: resolvedTheme(getPreferences().theme) === 'dark' ? 'light' : 'dark' }),
      })
    for (const p of navPages()) if (match(p.label)) out.push({ id: `page-${p.to}`, group: t('palette.pages'), label: p.label, icon: p.icon, run: go(href(p.to)) })
    for (const p of data.projects)
      if (match(p.name)) out.push({ id: `project-${p.id}`, group: t('palette.projects'), label: p.name, icon: 'folder', meta: p.tagline, run: go(`/proyectos/${p.slug}`) })
    for (const v of prefs.savedViews) if (match(v.name)) out.push({ id: `view-${v.id}`, group: t('palette.views'), label: v.name, icon: 'bookmark', run: go(v.path) })
    if (q) {
      const items = data.items.filter((i) => (scope === null || i.projectId === scope) && matchesQuery(i, query)).slice(0, 12)
      for (const i of items)
        out.push({ id: `item-${i.id}`, group: t('palette.items'), label: i.title, icon: 'list', meta: STATUSES[i.status].label, run: () => openItem(i.id) })
      out.push({
        id: 'search-all',
        group: t('palette.items'),
        label: t('palette.searchAll', { q: query.trim() }),
        icon: 'search',
        run: go(`/trabajo?${new URLSearchParams({ ...(scope ? { p: scope } : {}), q: query.trim(), estado: 'todos' })}`),
      })
    }
    return out
  }, [query, data, prefs.savedViews, scope, navigate, create, href, openItem])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (c: Command | undefined) => {
    if (!c) return
    onClose()
    c.run()
  }

  let lastGroup = ''
  return (
    <Modal open={open} title={t('palette.title')} onClose={onClose} className="palette" hideHeader>
      <div className="palette-input">
        <Icon name="search" size={18} />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={commands[active] ? `cmd-${commands[active].id}` : undefined}
          aria-label={t('palette.title')}
          placeholder={t('palette.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, commands.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(commands[active])
            }
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <ul className="palette-results" id="palette-results" role="listbox" ref={listRef} aria-label={t('palette.title')}>
        {commands.length === 0 && <li className="palette-group">{t('palette.empty')}</li>}
        {commands.map((c, n) => {
          const header = c.group !== lastGroup ? c.group : null
          lastGroup = c.group
          return [
            header && (
              <li key={`g-${header}`} className="palette-group" role="presentation">
                {header}
              </li>
            ),
            <li
              key={c.id}
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={n === active}
              className="palette-item"
              onMouseEnter={() => setActive(n)}
              onClick={() => run(c)}
            >
              <Icon name={c.icon} size={16} />
              <span>{c.label}</span>
              {c.meta && <span className="palette-meta">{c.meta}</span>}
            </li>,
          ]
        })}
      </ul>
      <div className="palette-foot">{t('palette.hint')}</div>
    </Modal>
  )
}
