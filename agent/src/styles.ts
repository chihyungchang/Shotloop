// The visual styles (engine/shotloop/styles.mjs), loaded once for the
// tools and the prompts.

export interface Style {
  id: string
  track: string
  name: { en: string }
  when: string
  avoid: string
  frames: string
  why: string
  looks: string[]
}

export const { STYLES, styleById, styleStills } = await import(new URL('../../engine/shotloop/styles.mjs', import.meta.url).href) as {
  STYLES: Style[]
  styleById: (id: string) => Style | null
  styleStills: (id: string) => string[]
}
