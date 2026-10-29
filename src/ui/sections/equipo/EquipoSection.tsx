// Equipo: las personas del estudio y quien colabora desde fuera. Las subsecciones son la
// faceta ?vista= de la URL (navigation.ts): miembros (por defecto), responsabilidades por
// área, asignaciones, carga de trabajo y externos. Las personas son del estudio; con un
// proyecto elegido (?p= o la ficha) solo cambia lo que se cuenta: su trabajo y sus horas.
import { useSearchParams } from 'react-router-dom'
import { t } from '../../../i18n'
import { useCanEdit } from '../../../data/store'
import { Icon } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { useScope, useUI } from '../../context'
import type { SectionPageProps } from '../registry'
import { EquipoAsignaciones } from './EquipoAsignaciones'
import { EquipoCarga } from './EquipoCarga'
import { EquipoExternos, EquipoMiembros } from './EquipoPersonas'
import { EquipoResponsabilidades } from './EquipoResponsabilidades'
import './equipo.css'

export default function EquipoSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  const vista = params.get('vista')
  const { project } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()

  const actions = canEdit ? (
    <>
      {vista === 'carga' && (
        <button type="button" className="btn" onClick={() => create('timeEntries')}>
          <Icon name="clock" size={16} /> {t('secciones.equipo.actions.logTime')}
        </button>
      )}
      <button type="button" className="btn btn-primary" onClick={() => create('members', vista === 'externos' ? { kind: 'external' } : undefined)}>
        <Icon name="plus" size={16} /> {vista === 'externos' ? t('secciones.equipo.actions.newExternal') : t('secciones.equipo.actions.newMember')}
      </button>
    </>
  ) : undefined

  return (
    <div className={embedded ? 'equipo-page' : 'page equipo-page'}>
      <SectionHeader
        id="equipo"
        embedded={embedded}
        actions={actions}
        subtitle={project ? t('secciones.equipo.subtitleIn', { project: project.name }) : undefined}
      />
      {project && (
        <p className="equipo-note">
          <Icon name="info" size={14} /> {t('secciones.equipo.scopeNote', { project: project.name })}
        </p>
      )}
      {vista === 'responsabilidades' ? (
        <EquipoResponsabilidades />
      ) : vista === 'asignaciones' ? (
        <EquipoAsignaciones />
      ) : vista === 'carga' ? (
        <EquipoCarga />
      ) : vista === 'externos' ? (
        <EquipoExternos />
      ) : (
        <EquipoMiembros />
      )}
    </div>
  )
}
