// Iconos de trazo (24×24), dibujados aquí para no depender de ninguna librería.
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4m8-4v4',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  board: 'M4 4h5v16H4zm6 0h5v10h-5zm6 0h4v7h-4z',
  scale: 'M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zm12 0-3 7a3 3 0 0 0 6 0z',
  message: 'M4 5h16v11H8l-4 4z',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  rocket: 'M5 15c-1.5 1.5-2 4-2 6 2 0 4.5-.5 6-2m-4-4 4 4m-4-4 3-6c2.5-4.5 7-6 11-6 0 4-1.5 8.5-6 11l-6 3m3-8.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0',
  book: 'M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zm0 15A1.5 1.5 0 0 0 5.5 21H20v-3',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.3-4.3',
  folder: 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  lock: 'M6 11h12v10H6zm2 0V7a4 4 0 1 1 8 0v4',
  pause: 'M8 5v14m8-14v14',
  check: 'M5 12.5 10 17 19 7',
  external: 'M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  chevronRight: 'm9 6 6 6-6 6',
  chevronDown: 'm6 9 6 6 6-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  bug: 'M8 9h8v6a4 4 0 0 1-8 0zm0 3H4m16 0h-4M9 5l1.5 2M15 5l-1.5 2M5 7l3 2m11-2-3 2M5 18l3-2m11 2-3-2',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  question: 'M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.2-1.3 2.1V14m0 3.5h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  git: 'M6 3v12m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm12-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0a9 9 0 0 1-9 9',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  download: 'M12 4v12m0 0 5-5m-5 5-5-5M4 20h16',
  upload: 'M12 20V8m0 0 5 5m-5-5-5 5M4 4h16',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1m2 3.7a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  edit: 'M4 20h4L19 9l-4-4L4 16zm9-13 4 4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
