export const HOME_AISLES = [
  {
    id: 'audio',
    eyebrow: 'Explore',
    title: 'Audio',
    tag: 'SOUND',
    navLabel: 'Audio',
    to: '/category/audio',
    category: 'audio',
  },
  {
    id: 'charging',
    eyebrow: 'Power Up',
    title: 'Charging',
    tag: 'ENERGY',
    navLabel: 'Power and Charging',
    to: '/category/charging',
    category: 'charging',
  },
  {
    id: 'essentials',
    eyebrow: 'Every Day',
    title: 'Accessories',
    tag: 'ESSENTIALS',
    navLabel: 'Accessories',
    to: '/shop',
    category: null,
  },
  {
    id: 'storage',
    eyebrow: 'Store More',
    title: 'Storage',
    tag: 'DEVICES',
    navLabel: 'Storage',
    to: '/category/storage',
    category: 'storage',
  },
] as const

export const HOME_MOSAIC = [
  { id: 'earphones', eyebrow: 'Sit', title: 'Still', tag: 'EARBUDS', to: '/category/audio', category: 'audio' },
  { id: 'charge', eyebrow: 'Stay', title: 'Ready', tag: 'POWER', to: '/category/charging', category: 'charging' },
  { id: 'desk', eyebrow: 'Work', title: 'Light', tag: 'DESK KIT', to: '/shop', category: null },
  { id: 'files', eyebrow: 'Keep', title: 'Copies', tag: 'STORAGE', to: '/category/storage', category: 'storage' },
  { id: 'speaker', eyebrow: 'Fill', title: 'A room', tag: 'SPEAKER', to: '/category/audio', category: 'audio' },
  { id: 'cables', eyebrow: 'Plug', title: 'Once', tag: 'CABLES', to: '/category/charging', category: 'charging' },
] as const
