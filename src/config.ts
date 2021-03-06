/* istanbul ignore file */
// This should probably use a config manager per env
// so this file doesn't need to exists. Ignore it from
// coverage for now since it can't be covered fully because
// NODE_ENV is always test

import path from 'path'

const production = process.env.NODE_ENV === 'production'
const test = process.env.NODE_ENV === 'test'
const tapChildId = process.env.TAP_CHILD_ID ?? '0'

export const MP3_DIR = test
  ? path.resolve(__dirname, '..', 'test', `mp3-${tapChildId}`)
  : production
  ? path.join('/', 'root', 'mp3')
  : path.resolve(__dirname, '..', 'mp3')

export const DB_PATH = test
  ? path.resolve(__dirname, '..', 'test', `db-${tapChildId}.json`)
  : path.resolve(__dirname, '..', 'db.json')

export const MAX_DIR_SIZE = production ? '18gb' : '1tb'

export const DELETE_LRU_INTERVAL = '1d'

export const PORT = process.env.PORT || 3000 + +tapChildId
