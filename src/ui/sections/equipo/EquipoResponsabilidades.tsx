// Equipo › Responsabilidades: quién responde de cada área (las líneas de trabajo del
// estudio), qué áreas no tienen a nadie y lo que cada persona dice que lleva.
import { Link } from 'react-router-dom'
import { teamResponsibilities, teamRoster } from '../../../domain/selectors'
import { t } from '../../../i18n'
import { useStudioData } from '../../../data/store'
import { AreaTag, Pill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useScope } from '../../context'
import { MemberButton, openLabel, TeamEmpty } from './comunes'

export function EquipoResponsabilidades() {
  const data = useStudioData()
  const { scope, href } = useScope()
  const { areas, unowned } = teamResponsibilities(data, scope)
  const { active } = teamRoster(data)

  if (!data.areas.length)
    return (
      <Card>
        <Empty icon="layers">
          {t('secciones.equipo.responsabilidades.noAreas')}{' '}
          <Link to={href('/ajustes?seccion=categorias')}>{t('secciones.equipo.responsabilidades.toSettings')}</Link>
        </Empty>
      </Card>
    )

  const L = (k: 'area' | 'owners' | 'open') => t(`secciones.equipo.responsabilidades.${k}`)
  const work = (areaId: string, n: number) =>
    n ? <Link to={href(`/tareas?area=${encodeURIComponent(areaId)}`)}>{openLabel(n)}</Link> : <span className="muted">{openLabel(0)}</span>

  // Si nadie responde de nada, la tabla ya lo dice todo: sin la lista de áreas sin responsable al lado.
  const someOwned = unowned.length < areas.length
  return (
    <>
      {!data.members.length && <TeamEmpty />}
      <div className={someOwned || active.length ? 'equipo-grid' : 'equipo-col'}>
        <div className="equipo-col">
          <Card title={t('secciones.equipo.responsabilidades.byAreaTitle')} icon="layers" subtitle={t('secciones.equipo.responsabilidades.byAreaSubtitle')}>
            <div className="table-wrap">
              <table className="table equipo-table">
                <caption className="visually-hidden">{t('secciones.equipo.responsabilidades.caption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{L('area')}</th>
                    <th scope="col">{L('owners')}</th>
                    <th scope="col">{L('open')}</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((row) => (
                    <tr key={row.area.id}>
                      <th scope="row" className="record-title">
                        <AreaTag area={row.area} />
                      </th>
                      <td data-label={L('owners')}>
                        <span className="equipo-owners">
                          {row.owners.length ? (
                            row.owners.map((m) => <MemberButton key={m.id} member={m} />)
                          ) : (
                            <Pill tone="warning" icon="alert">
                              {t('secciones.equipo.responsabilidades.nobody')}
                            </Pill>
                          )}
                          {row.former.length > 0 && (
                            <span className="muted small">
                              {t('secciones.equipo.responsabilidades.formerOwners', { names: row.former.map((m) => m.name).join(', ') })}
                            </span>
                          )}
                        </span>
                      </td>
                      <td data-label={L('open')}>{work(row.area.id, row.open)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        {(someOwned || active.length > 0) && (
          <div className="equipo-col">
            {someOwned && (
              <Card
                title={t('secciones.equipo.responsabilidades.unownedTitle')}
                icon="alert"
                subtitle={unowned.length ? t('secciones.equipo.responsabilidades.unownedSubtitle') : undefined}
              >
                {unowned.length ? (
                  <ul className="equipo-list">
                    {unowned.map((row) => (
                      <li key={row.area.id}>
                        <AreaTag area={row.area} />
                        <span className="small">{work(row.area.id, row.open)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>{t('secciones.equipo.responsabilidades.unownedNone')}</Empty>
                )}
              </Card>
            )}
            {active.length > 0 && (
              <Card title={t('secciones.equipo.responsabilidades.peopleTitle')} icon="user" subtitle={t('secciones.equipo.responsabilidades.peopleSubtitle')}>
                <ul className="equipo-list equipo-people">
                  {active.map((m) => (
                    <li key={m.id}>
                      <span className="equipo-person-head">
                        <Icon name="user" size={14} />
                        <MemberButton member={m} />
                        {m.role && <span className="muted small">{m.role}</span>}
                      </span>
                      {m.responsibilities ? (
                        <p className="equipo-text">{m.responsibilities}</p>
                      ) : (
                        <p className="muted small">{t('secciones.equipo.values.undescribed')}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}
