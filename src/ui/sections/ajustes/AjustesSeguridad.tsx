// Ajustes › Seguridad: dónde están los datos, quién puede entrar y verlos, contraseñas,
// copias y lo que no se puede deshacer. Lo principal es la web en Cloudflare Workers con
// Cloudflare Access (datos en el navegador de cada persona); la página de claude.ai es la
// otra forma, opcional. Si esta copia es la de claude.ai, se explica la suya.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { privateCollections } from '../../../domain/selectors'
import { t, tr } from '../../../i18n'
import { EN_CLAUDE } from '../../../data/runtime'
import { useCanEdit, useStoreMeta, useStoreStatus } from '../../../data/store'
import { Card } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { useFormat } from '../../hooks'
import { joinList, useAjustesHref } from './comunes'

/** Una línea con icono (el icono no lleva significado propio: lo dice el texto). */
function Line({ icon, children, tone }: { icon: IconName; children: ReactNode; tone?: 'warning' }) {
  return (
    <li className={tone ? `ajustes-line ajustes-line-${tone}` : 'ajustes-line'}>
      <Icon name={icon} size={15} />
      <span>{children}</span>
    </li>
  )
}

export function AjustesSeguridad() {
  const status = useStoreStatus()
  const meta = useStoreMeta()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const ajustesHref = useAjustesHref()
  const k = (key: string) => tr(`secciones.ajustes.seguridad.${key}`)
  const finance = joinList(privateCollections().map((c) => tr(`collectionNames.${c}.other`)))

  return (
    <div className="grid grid-2 ajustes-grid">
      <Card title={t('secciones.ajustes.seguridad.where')} icon="box">
        <ul className="ajustes-lines">
          {EN_CLAUDE ? (
            <Line icon="globe">{k('whereClaude')}</Line>
          ) : (
            <>
              <Line icon="box">{k('whereLocal')}</Line>
              <Line icon="users">{k('whereLocalOthers')}</Line>
            </>
          )}
          {!status.remote && (
            <Line icon="clock">
              {meta.savedAt ? t('secciones.ajustes.seguridad.lastSaved', { date: fmt.dateTime(meta.savedAt) }) : t('secciones.ajustes.seguridad.neverSaved')}
            </Line>
          )}
          {status.saveError && (
            <Line icon="alert" tone="warning">
              {status.saveError}
            </Line>
          )}
        </ul>
      </Card>

      <Card title={t('secciones.ajustes.seguridad.who')} icon="shield">
        <ul className="ajustes-lines">
          {EN_CLAUDE ? (
            <>
              <Line icon="lock">{k('whoClaudeShare')}</Line>
              <Line icon="edit">{k('whoClaudeRoles')}</Line>
              <Line icon="wallet">{t('secciones.ajustes.seguridad.whoClaudePrivate', { list: finance })}</Line>
            </>
          ) : (
            <>
              <Line icon="lock">{k('whoAccess')}</Line>
              <Line icon="users">{k('whoAccessData')}</Line>
              <Line icon="alert" tone="warning">
                {k('whoSharedComputer')}
              </Line>
            </>
          )}
          <Line icon={canEdit ? 'checkCircle' : 'eye'}>{canEdit ? k('youCanEdit') : k('youReadOnly')}</Line>
        </ul>
      </Card>

      <Card title={t('secciones.ajustes.seguridad.passwords')} icon="lock">
        <ul className="ajustes-lines">
          <Line icon="checkCircle">{k('passwordsNone')}</Line>
          <Line icon="shield">{EN_CLAUDE ? k('passwordsClaude') : k('passwordsAccess')}</Line>
          <Line icon="alert" tone="warning">
            {k('passwordsDont')}
          </Line>
        </ul>
      </Card>

      <Card title={t('secciones.ajustes.seguridad.backups')} icon="download">
        <ul className="ajustes-lines">
          <Line icon="download">{k('backupsBody')}</Line>
          <Line icon="git">{k('repo')}</Line>
          {!EN_CLAUDE && <Line icon="eye">{k('headers')}</Line>}
        </ul>
        <Link to={ajustesHref('datos')} className="btn btn-small">
          <Icon name="download" size={14} /> {t('secciones.ajustes.seguridad.backupsGo')}
        </Link>
      </Card>

      <Card title={t('secciones.ajustes.seguridad.irreversible')} icon="alert">
        <ul className="ajustes-lines">
          {!EN_CLAUDE && <Line icon="trash">{k('irreversibleItems.siteData')}</Line>}
          <Line icon="upload">{k('irreversibleItems.importReset')}</Line>
          <Line icon="trash">{k('irreversibleItems.remove')}</Line>
          <Line icon="tag">{k('irreversibleItems.merge')}</Line>
          {EN_CLAUDE ? (
            <>
              <Line icon="users">{k('irreversibleItems.claudeOthers')}</Line>
              <Line icon="lock">{k('irreversibleItems.claudeShare')}</Line>
            </>
          ) : (
            <Line icon="lock">{k('irreversibleItems.access')}</Line>
          )}
        </ul>
      </Card>

      <Card title={EN_CLAUDE ? t('secciones.ajustes.seguridad.mainWay') : t('secciones.ajustes.seguridad.otherWay')} icon="globe">
        <p className="small">{EN_CLAUDE ? k('mainWayBody') : k('otherWayBody')}</p>
      </Card>
    </div>
  )
}
