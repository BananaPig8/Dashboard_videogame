// Gráficas de Estadísticas, en SVG y sin librerías: columnas por semana o por mes (una o dos
// series), barras horizontales con su cifra en texto y la evolución de una métrica. Todas
// llevan nombre accesible, su tabla de datos y los colores de la paleta (--series-1/2).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ISODate } from '../../../domain/types'
import { daysBetween } from '../../../domain/dates'
import { t } from '../../../i18n'

/**
 * El ancho real de la gráfica, para dibujarla a escala 1:1: así los textos del eje miden lo
 * mismo en el móvil que en una pantalla ancha (sin medir todavía, `fallback`).
 */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

/** El tope del eje: 4, 6, 8, 10, 20, 40… (la mitad también es entera). `unit` = 60 para minutos (en horas). */
export function niceMax(max: number, unit = 1): number {
  const x = max / unit
  if (x <= 4) return 4 * unit
  const p = 10 ** Math.floor(Math.log10(x))
  for (const c of [1, 2, 4, 6, 8, 10]) if (c * p >= x) return c * p * unit
  return 10 * p * unit
}

/** Barra con la esquina de arriba redondeada y la base recta (anclada al eje). */
function topRoundedBar(x: number, y: number, w: number, h: number, r = 3): string {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

export interface ChartSeries {
  id: string
  label: string
  values: number[]
}

/** Columnas por periodo (semanas o meses): una serie, o dos agrupadas en el mismo eje. */
export function ColumnChart({
  labels,
  longLabels = labels,
  series,
  format = String,
  unit = 1,
  title,
  headLabel,
}: {
  /** Lo que se lee bajo cada columna («12 oct»). */
  labels: string[]
  /** Para la ayuda y la tabla («Semana del 12 oct»). */
  longLabels?: string[]
  series: ChartSeries[]
  format?: (n: number) => string
  /** 60 si los valores son minutos (el eje va en horas enteras). */
  unit?: number
  /** Nombre de la gráfica (para lectores de pantalla). */
  title: string
  /** Primera columna de la tabla («Semana», «Mes»). */
  headLabel: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const { ref, width: W } = useWidth(640)
  const H = 200
  const pad = { l: 46, r: 8, t: 10, b: 26 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const top = niceMax(Math.max(0, ...series.flatMap((s) => s.values)), unit)
  const band = innerW / Math.max(1, labels.length)
  const two = series.length > 1
  const barW = Math.max(4, Math.min(two ? 18 : 28, two ? (band - 10) / 2 : band - 12))
  const y = (v: number) => pad.t + innerH - (v / top) * innerH
  const ticks = [0, top / 2, top]
  // Una etiqueta cada tantas columnas como haga falta para que no se pisen (unos 56 px cada una).
  const labelEvery = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(innerW / 56))))
  const totals = series.map((s) => s.values.reduce((a, b) => a + b, 0))
  const describe = series.map((s, k) => t('secciones.estadisticas.chart.total', { label: s.label, value: format(totals[k]) })).join('; ')

  return (
    <figure className="chart estadisticas-chart">
      {two && (
        <div className="chart-legend" aria-hidden="true">
          {series.map((s, k) => (
            <span key={s.id}>
              <i className={`swatch series-${k + 1}-bg`} /> {s.label} ({format(totals[k])})
            </span>
          ))}
        </div>
      )}
      <div className="chart-wrap" ref={ref} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`${title}. ${describe}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis-line' : 'grid-line'} />
              <text x={pad.l - 6} y={y(v) + 4} className="tick" textAnchor="end">
                {format(v)}
              </text>
            </g>
          ))}
          {labels.map((label, k) => {
            const cx = pad.l + band * k + band / 2
            return (
              <g key={`${label}-${k}`}>
                {hover === k && <rect x={cx - band / 2} y={pad.t} width={band} height={innerH} className="hover-band" />}
                {series.map((s, i) => {
                  const x = two ? (i === 0 ? cx - barW - 1 : cx + 1) : cx - barW / 2
                  return <path key={s.id} d={topRoundedBar(x, y(s.values[k]), barW, y(0) - y(s.values[k]))} className={`series-${i + 1}`} />
                })}
                {k % labelEvery === 0 && (
                  <text x={cx} y={H - 8} className="tick" textAnchor="middle">
                    {label}
                  </text>
                )}
                <rect
                  x={cx - band / 2}
                  y={pad.t}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  className="estadisticas-hit"
                  onMouseEnter={() => setHover(k)}
                  onFocus={() => setHover(k)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${longLabels[k]}: ${series.map((s) => `${s.label} ${format(s.values[k])}`).join(', ')}`}
                />
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div className="chart-tooltip" style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%` }} role="status">
            <strong>{longLabels[hover]}</strong>
            {series.map((s, i) => (
              <span key={s.id}>
                <i className={`swatch series-${i + 1}-bg`} /> {s.label}: {format(s.values[hover])}
              </span>
            ))}
          </div>
        )}
      </div>
      <DataTable head={[headLabel, ...series.map((s) => s.label)]} rows={longLabels.map((l, k) => [l, ...series.map((s) => format(s.values[k]))])} />
    </figure>
  )
}

/** «Ver como tabla»: los mismos datos que la gráfica, en una tabla. */
function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <details className="chart-table">
      <summary>{t('secciones.estadisticas.chart.asTable')}</summary>
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k}>
              {r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export interface BarRow {
  key: string
  label: ReactNode
  value: number
  /** La cifra en texto (la barra no se lee: es solo la proporción). */
  display: string
  /** Si la cifra lleva a otra pantalla (Tareas filtrada, la ficha…). */
  to?: string
  /** Texto pequeño bajo la etiqueta. */
  hint?: ReactNode
}

/** Barras horizontales: etiqueta, proporción frente a la mayor y la cifra en texto. */
export function BarList({ rows, label }: { rows: BarRow[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="estadisticas-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key}>
          <span className="estadisticas-bar-label">
            {r.label}
            {r.hint && <span className="muted small estadisticas-bar-hint">{r.hint}</span>}
          </span>
          <span className="estadisticas-bar-track" aria-hidden="true">
            <span style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="estadisticas-bar-value num">{r.to ? <Link to={r.to}>{r.display}</Link> : r.display}</span>
        </li>
      ))}
    </ul>
  )
}

/** La evolución de una métrica: los datos en su fecha (eje de tiempo real), unidos por una línea. */
export function LineChart({
  points,
  title,
  format,
  formatDate,
}: {
  points: { date: ISODate; value: number }[]
  title: string
  format: (n: number) => string
  formatDate: (d: ISODate) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const { ref, width: W } = useWidth(480)
  const H = 160
  const pad = { l: 46, r: 14, t: 12, b: 24 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const top = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const span = points.length > 1 ? daysBetween(points[0].date, points[points.length - 1].date) : 0
  // Con todos el mismo día no hay tiempo que repartir: se reparten por orden.
  const x = (k: number) => pad.l + (span > 0 ? daysBetween(points[0].date, points[k].date) / span : points.length > 1 ? k / (points.length - 1) : 0.5) * innerW
  const y = (v: number) => pad.t + innerH - (v / top) * innerH
  const path = points.map((p, k) => `${k ? 'L' : 'M'}${x(k)},${y(p.value)}`).join('')
  const last = points[points.length - 1]
  return (
    <figure className="chart estadisticas-chart">
      <div className="chart-wrap" ref={ref} onMouseLeave={() => setHover(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          role="img"
          aria-label={`${title}: ${points.map((p) => `${formatDate(p.date)} ${format(p.value)}`).join(', ')}`}
        >
          {[0, top / 2, top].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis-line' : 'grid-line'} />
              <text x={pad.l - 6} y={y(v) + 4} className="tick" textAnchor="end">
                {format(v)}
              </text>
            </g>
          ))}
          <text x={pad.l} y={H - 6} className="tick" textAnchor="start">
            {formatDate(points[0].date)}
          </text>
          {points.length > 1 && (
            <text x={W - pad.r} y={H - 6} className="tick" textAnchor="end">
              {formatDate(last.date)}
            </text>
          )}
          <path d={path} className="estadisticas-line" />
          {points.map((p, k) => (
            <g key={k}>
              <circle cx={x(k)} cy={y(p.value)} r={hover === k ? 6 : 4} className="estadisticas-dot" />
              {/* Zona de acierto mayor que el punto (ratón y teclado). */}
              <circle
                cx={x(k)}
                cy={y(p.value)}
                r={12}
                fill="transparent"
                className="estadisticas-hit"
                tabIndex={0}
                aria-label={`${formatDate(p.date)}: ${format(p.value)}`}
                onMouseEnter={() => setHover(k)}
                onFocus={() => setHover(k)}
                onBlur={() => setHover(null)}
              />
            </g>
          ))}
        </svg>
        {hover !== null && (
          <div className="chart-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <strong>{formatDate(points[hover].date)}</strong>
            <span>{format(points[hover].value)}</span>
          </div>
        )}
      </div>
      <DataTable
        head={[t('secciones.estadisticas.chart.date'), t('secciones.estadisticas.chart.value')]}
        rows={points.map((p) => [formatDate(p.date), format(p.value)])}
      />
    </figure>
  )
}
