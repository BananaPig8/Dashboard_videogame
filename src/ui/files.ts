// Ofrecer un fichero para guardar. En el navegador, con un enlace de descarga; en la página
// de claude.ai las descargas solo van por su capacidad «downloads» (pide confirmación).
import { capability, EN_CLAUDE } from '../data/runtime'

export type SaveResult = 'saved' | 'declined' | 'unavailable'

export async function saveFile(filename: string, text: string, type = 'application/json'): Promise<SaveResult> {
  if (EN_CLAUDE) {
    const downloads = await capability('downloads')
    if (!downloads) return 'unavailable'
    try {
      await downloads.save({ filename, data: text })
      return 'saved'
    } catch (e) {
      return (e as { code?: string })?.code === 'declined' ? 'declined' : 'unavailable'
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'saved'
}
