// Tabla de registros de cualquier colección (builds, fichas, movimientos, personas…): la
// primera columna es un botón que abre el elemento; en móvil cada fila es una tarjeta.
import type { ReactNode } from 'react'
import { t } from '../../i18n'
import { Empty } from './Common'

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  /** Alinear a la derecha (importes, números). */
  numeric?: boolean
}

export function RecordTable<T extends { id: string }>({
  rows,
  columns,
  caption,
  title,
  onOpen,
  empty,
}: {
  rows: T[]
  columns: Column<T>[]
  /** Para lectores de pantalla: qué tabla es. */
  caption: string
  /** Lo que se lee de cada fila en la primera columna (y abre el elemento). */
  title: (row: T) => ReactNode
  onOpen?: (row: T) => void
  empty?: ReactNode
}) {
  if (!rows.length) return <Empty icon="list">{empty ?? t('records.empty')}</Empty>
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('records.name')}</th>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? 'num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row" className="record-title">
                {onOpen ? (
                  <button type="button" className="link-btn" onClick={() => onOpen(row)}>
                    {title(row)}
                  </button>
                ) : (
                  title(row)
                )}
              </th>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label} className={c.numeric ? 'num' : undefined}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
