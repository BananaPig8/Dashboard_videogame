// Panel: en el estudio («/»), lo importante de todos los juegos; en la ficha de un proyecto,
// su pestaña «Resumen». Sin ?ver=, los bloques personalizables de siempre; con ?ver= (las
// subsecciones), el modo foco: solo los bloques de esa vista (PANEL_FOCUS), a todo el ancho.
// La cabecera (saludo, Crear, proyecto, periodo y accesos rápidos) está en PanelHeader.
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { yearOf } from '../../../domain/dates'
import { useStudioData } from '../../../data/store'
import { useScope } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { PANEL_FOCUS } from '../../navigation'
import type { SectionPageProps } from '../registry'
import { PanelHeader } from './PanelHeader'
import { usePanelPeriod } from './periodo'
import { CustomizePanel, FocusArea, ProjectSummaryTab, WidgetArea } from './WidgetArea'
import './panel.css'

/**
 * Al entrar en una vista (?ver=) o volver al resumen, la cabecera y los bloques se sustituyen y
 * el enlace pulsado («Ver todas», «Volver al resumen») desaparece: el foco no puede quedarse en
 * la página. Al entrar, va a la pestaña de la vista; al volver, al enlace que llevaba a ella (o
 * a la pestaña «Resumen»).
 */
function useFocusOnView(ver: string | null) {
  const prev = useRef(ver)
  useEffect(() => {
    const was = prev.current
    prev.current = ver
    if (was === ver) return
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const a = document.activeElement
        if (a && a !== document.body && a.isConnected) return
        const back = was && !ver ? document.querySelector<HTMLElement>(`.widget-grid a[href*="ver=${CSS.escape(was)}"]`) : null
        const tab = document.querySelector<HTMLElement>('.section-tabs [aria-current]')
        ;(back ?? tab ?? document.getElementById('contenido'))?.focus()
      }),
    )
  }, [ver])
}

export default function PanelSection({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const today = useToday()
  const fmt = useFormat()
  const [params] = useSearchParams()
  const [customizing, setCustomizing] = useState(false)
  const ver = params.get('ver')
  const focus = ver ? PANEL_FOCUS[ver] : undefined
  const { period } = usePanelPeriod()
  const props = { data, scope, today, year: yearOf(today), fmt, period }
  useFocusOnView(ver)

  return (
    <div className={embedded ? 'stack' : 'page'}>
      <PanelHeader embedded={embedded} onCustomize={() => setCustomizing(true)} />
      {focus ? <FocusArea ids={focus} {...props} /> : embedded ? <ProjectSummaryTab /> : <WidgetArea {...props} />}
      <CustomizePanel open={customizing} onClose={() => setCustomizing(false)} />
    </div>
  )
}
