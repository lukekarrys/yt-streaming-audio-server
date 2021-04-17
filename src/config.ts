import path from 'path'

const production = process.env.NODE_ENV === 'production'

export const MP3_DIR = production
  ? path.join('/', 'root', 'mp3')
  : path.resolve(__dirname, '..', 'mp3')

export const MAX_DIR_SIZE = production ? '18gb' : '1tb'

export const DELETE_LRU_INTERVAL = '1d'
