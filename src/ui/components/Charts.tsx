// Gráficas en SVG, sin librerías. Colores de la paleta categórica validada
// (azul = commits, naranja = terminados), con su versión para el tema oscuro en styles.css.
import { useState } from 'react'
import { t } from '../../i18n'
import { useElementWidth, useFormat } from '../hooks'
import type { Bucket } from '../../domain/selectors'

/** Minigráfica de barras: actividad por día. Una sola serie, sin leyenda. */
export function Sparkline({ values, label, startLabel }: { values: number[]; label: string; startLabel?: string }) {
  const w = 120
  const h = 28
  const max = Math.max(1, ...values)
  const step = w / values.length
  const bar = Math.max(1, step - 1)
  const total = values.reduce((a, b) => a + b, 0)
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={t('charts.total', { label, n: total })}>
      <line x1={0} y1={h - 0.5} x2={w} y2={h - 0.5} className="axis-line" />
      {values.map((v, k) =>
        v === 0 ? null : (
          <rect key={k} x={k * step} y={h - 1 - (v / max) * (h - 3)} width={bar} height={(v / max) * (h - 3)} rx={1} className="series-1">
            <title>{startLabel ? t('charts.dayFrom', { start: startLabel, n: k, value: v }) : t('charts.day', { n: k + 1, value: v })}</title>
          </rect>
        ),
      )}
    </svg>
  )
}

/** Barra con la esquina de arriba redondeada y la base recta (anclada al eje). */
function topRoundedBar(x: number, y: number, w: number, h: number, r = 3): string {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

/** Evolución semanal: commits y elementos terminados, barras agrupadas en un solo eje. */
export function WeeklyChart({ buckets, year }: { buckets: Bucket[]; year: number }) {
  const fmt = useFormat()
  const formatDate = fmt.date
  const [hover, setHover] = useState<number | null>(null)
  // Se dibuja al ancho real: los textos del eje miden lo mismo en una tarjeta ancha que en un móvil.
  const { ref, width: W } = useElementWidth(640)
  const H = 200
  const pad = { l: 30, r: 8, t: 10, b: 26 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const max = Math.max(4, ...buckets.flatMap((b) => [b.commits, b.completed]))
  const niceMax = Math.ceil(max / 5) * 5
  const band = innerW / buckets.length
  const barW = Math.max(3, Math.min(18, (band - 10) / 2))
  const y = (v: number) => pad.t + innerH - (v / niceMax) * innerH
  const ticks = [0, niceMax / 2, niceMax]
  // Una fecha cada tantas columnas como haga falta para que no se pisen (unos 56 px cada una).
  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(innerW / 56))))
  const totalCommits = buckets.reduce((s, b) => s + b.commits, 0)
  const totalDone = buckets.reduce((s, b) => s + b.completed, 0)

  return (
    <figure className="chart">
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i className="swatch series-1-bg" /> {t('charts.legendCommits', { n: totalCommits })}
        </span>
        <span>
          <i className="swatch series-2-bg" /> {t('charts.legendDone', { n: totalDone })}
        </span>
      </div>
      <div className="chart-wrap" ref={ref} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={t('charts.weeklySummary', { commits: totalCommits, done: totalDone })}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-line' : 'grid-line'} />
              <text x={pad.l - 6} y={y(t) + 4} className="tick" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {buckets.map((b, k) => {
            const cx = pad.l + band * k + band / 2
            return (
              <g key={b.start}>
                {hover === k && <rect x={cx - band / 2} y={pad.t} width={band} height={innerH} className="hover-band" />}
                <path d={topRoundedBar(cx - barW - 1, y(b.commits), barW, y(0) - y(b.commits))} className="series-1" />
                <path d={topRoundedBar(cx + 1, y(b.completed), barW, y(0) - y(b.completed))} className="series-2" />
                {k % labelEvery === 0 && (
                  <text x={cx} y={H - 8} className="tick" textAnchor="middle">
                    {formatDate(b.start, year)}
                  </text>
                )}
                <rect
                  x={cx - band / 2}
                  y={pad.t}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(k)}
                  onFocus={() => setHover(k)}
                  tabIndex={0}
                  aria-label={t('charts.weekPoint', { date: formatDate(b.start, year), commits: b.commits, done: b.completed })}
                />
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div className="chart-tooltip" style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%` }} role="status">
            <strong>{t('charts.weekOf', { date: formatDate(buckets[hover].start, year) })}</strong>
            <span>
              <i className="swatch series-1-bg" /> {t('charts.commits', { n: buckets[hover].commits })}
            </span>
            <span>
              <i className="swatch series-2-bg" /> {t('charts.done', { n: buckets[hover].completed })}
            </span>
          </div>
        )}
      </div>
      <details className="chart-table">
        <summary>{t('charts.asTable')}</summary>
        <table>
          <caption className="visually-hidden">{t('charts.weeklyCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('charts.week')}</th>
              <th scope="col">{t('charts.commitsCol')}</th>
              <th scope="col">{t('charts.doneCol')}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.start}>
                <td>{formatDate(b.start, year)}</td>
                <td>{b.commits}</td>
                <td>{b.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
