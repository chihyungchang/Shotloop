import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { t } from '../i18n'
import { Icon } from './Icon'

// A product promo's material on Home: the product's page or GitHub
// repository, or its repository on this Mac, read before the plan, and
// the person's own pictures (picked, pasted or dropped), saved into the
// project once it is created (api.addImage)

export interface PromoImage { id: number; name: string; bytes: Uint8Array; url: string }

const MAX_IMAGES = 12
const MAX_MB = 20

// PNG and JPEG as they are; any other picture the webview can decode
// (WebP, GIF, HEIC from a screenshot tool) redrawn as PNG
async function toBytes(file: File): Promise<Uint8Array> {
  if (file.type === 'image/png' || file.type === 'image/jpeg') return new Uint8Array(await file.arrayBuffer())
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error(file.name)
  return new Uint8Array(await blob.arrayBuffer())
}

const hasPictures = (e: DragEvent) => [...e.dataTransfer.items].some(i => i.kind === 'file' && i.type.startsWith('image/'))

// The pictures as the person adds them; error says what was turned away
export function usePromoImages() {
  const [images, setImages] = useState<PromoImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const next = useRef(0)
  const count = useRef(0)
  count.current = images.length
  const add = async (files: File[]) => {
    const pictures = files.filter(f => f.type.startsWith('image/'))
    if (!pictures.length) return
    setError(null)
    const room = MAX_IMAGES - count.current
    if (pictures.length > room) setError(t('promo.tooMany', { n: MAX_IMAGES }))
    const added: PromoImage[] = []
    for (const f of pictures.slice(0, Math.max(0, room))) {
      try {
        const bytes = await toBytes(f)
        if (bytes.length > MAX_MB << 20) {
          setError(t('promo.tooBig', { name: f.name, mb: MAX_MB }))
          continue
        }
        // A pasted picture has no name of its own
        const name = f.name && f.name !== 'image.png' ? f.name : `screenshot-${next.current + 1}.png`
        added.push({ id: ++next.current, name, bytes, url: URL.createObjectURL(new Blob([bytes as BlobPart], { type: f.type === 'image/jpeg' ? 'image/jpeg' : 'image/png' })) })
      } catch {
        setError(t('promo.unreadable', { name: f.name || t('promo.pasted') }))
      }
    }
    count.current += added.length
    setImages(list => [...list, ...added])
  }
  const remove = (id: number) => setImages(list => {
    const gone = list.find(i => i.id === id)
    if (gone) URL.revokeObjectURL(gone.url)
    return list.filter(i => i.id !== id)
  })
  // The previews go with the composer
  const live = useRef(images)
  live.current = images
  useEffect(() => () => live.current.forEach(i => URL.revokeObjectURL(i.url)), [])
  return { images, add, remove, error }
}

// Pictures dragged over a box: the handlers for it, and whether some are
// over it now (the box shows where they will land). Children firing
// enter and leave as the pointer crosses them are counted, so the state
// holds until the pointer leaves the box itself
export function usePictureDrop(drop: (files: File[]) => void) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const handlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasPictures(e)) return
      e.preventDefault()
      depth.current++
      setOver(true)
    },
    onDragOver: (e: DragEvent) => {
      if (!hasPictures(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: () => {
      if (depth.current && --depth.current === 0) setOver(false)
    },
    onDrop: (e: DragEvent) => {
      depth.current = 0
      setOver(false)
      if (!e.dataTransfer.files.length) return
      e.preventDefault()
      drop([...e.dataTransfer.files])
    }
  }
  return { over, handlers }
}

// What a drop over the composer does, said over it while pictures are held
export function DropOverlay() {
  return (
    <div className="drop-overlay" aria-hidden>
      <Icon name="image" size={22} />
      <strong>{t('promo.dropNow')}</strong>
    </div>
  )
}

// The page's address and the pictures, under the idea: a drop zone while
// there are none, then the thumbnails with a tile to add more
export function PromoMaterial({ site, setSite, repo, setRepo, images, add, remove }: {
  site: string
  setSite: (s: string) => void
  repo: string
  setRepo: (s: string) => void
} & Pick<ReturnType<typeof usePromoImages>, 'images' | 'add' | 'remove'>) {
  const picker = useRef<HTMLInputElement>(null)
  const choose = () => picker.current?.click()
  const chooseRepo = async () => {
    const dir = await pick({ directory: true, title: t('promo.repoDialog') })
    if (typeof dir === 'string') setRepo(dir)
  }
  return (
    <div className="promo-material">
      <div className="promo-sources">
        <label className="promo-site">
          <Icon name="link" size={14} />
          <input type="url" inputMode="url" spellCheck={false} value={site} onChange={e => setSite(e.target.value)}
            placeholder={t('promo.sitePlaceholder')} aria-label={t('promo.site')} />
        </label>
        {repo
          ? (
            <span className="promo-repo" title={repo}>
              <Icon name="folder" size={13} /> <span className="ellipsis">{repo.split('/').filter(Boolean).at(-1)}</span>
              <button type="button" onClick={() => setRepo('')} aria-label={t('promo.repoRemove')}><Icon name="x" size={10} /></button>
            </span>
          )
          : <button type="button" className="promo-repo-pick" onClick={chooseRepo} title={t('promo.repoHint')}><Icon name="folder" size={13} /> {t('promo.repoLocal')}</button>}
      </div>
      {images.length === 0
        ? (
          <button type="button" className="promo-drop" onClick={choose}>
            <span className="promo-drop-icon"><Icon name="image" size={18} /></span>
            <span className="promo-drop-text">
              <strong>{t('promo.drop')}</strong>
              <span className="muted small">{t('promo.dropFormats', { n: MAX_IMAGES })}</span>
            </span>
          </button>
        )
        : (
          <div className="promo-images" aria-label={t('promo.images')}>
            {images.map(i => (
              <figure key={i.id} className="promo-thumb" title={i.name}>
                <img src={i.url} alt={i.name} />
                <button type="button" className="promo-remove" onClick={() => remove(i.id)} aria-label={t('promo.remove', { name: i.name })}><Icon name="x" size={10} /></button>
              </figure>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" className="promo-add" onClick={choose} title={t('promo.drop')} aria-label={t('promo.add')}>
                <Icon name="plus" size={16} />
              </button>
            )}
            <span className="promo-count muted small">{t('promo.count', { n: images.length, max: MAX_IMAGES })}</span>
          </div>
        )}
      <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden
        onChange={e => {
          add([...(e.target.files ?? [])])
          e.target.value = ''
        }} />
    </div>
  )
}
