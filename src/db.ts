import low from 'lowdb'
import FileAsync from 'lowdb/adapters/FileAsync'
import path from 'path'
import { MP3_DIR, DB_PATH } from './config'
import fs from 'fs-extra'
import bytes from 'bytes'

export type MP3 = { id: string; lastRead: number; contentLength: number }
export type FullMP3 = MP3 & {
  lastReadDate: Date
  contentLengthHuman: string
  path: string
}
type Schema = { files: MP3[] }

export type DB = {
  peek: (id: string) => Promise<void>
  deleteLRU: (
    maxSize: number
  ) => Promise<{ deleted: FullMP3[]; prevTotal: number }>
  seedLRU: () => Promise<FullMP3[]>
  read: () => Promise<FullMP3[]>
  get: (id: string) => Promise<FullMP3 | null>
  download: (
    id: string,
    downloader: (filepath: string) => Promise<unknown>
  ) => Promise<FullMP3>
  teardown: () => Promise<void>
  db: low.LowdbAsync<Schema>
}

const getFullVideo = (file: MP3): FullMP3 => ({
  ...file,
  contentLengthHuman: bytes.format(file.contentLength),
  lastReadDate: new Date(file.lastRead),
  path: path.join(MP3_DIR, `${file.id}.mp3`),
})

const deleteLRU = async (db: DB['db'], maxSize: number) => {
  const files = db.get('files')

  const total = files.reduce((acc, file) => acc + file.contentLength, 0).value()

  const toDelete: MP3[] = []

  if (total > maxSize) {
    const amountOver = total - maxSize
    const leastRecent = files
      .orderBy(['lastRead', 'contentLength'], ['asc', 'desc'])
      .value()

    let sum = 0

    for (const file of leastRecent) {
      sum += file.contentLength
      toDelete.push(file)
      if (sum >= amountOver) {
        break
      }
    }
  }

  const deleted = await Promise.all(
    toDelete.map(async (v) => {
      const file = getFullVideo(v)
      await fs.remove(file.path)
      await files.remove({ id: file.id }).write()
      return file
    })
  )

  return {
    prevTotal: total,
    deleted,
  }
}

const seedLRU = async (db: DB['db']) => {
  const files = db.get('files')
  const filesById = files.groupBy('id').value()
  const fsFiles = await fs.readdir(MP3_DIR)

  const missingIds = fsFiles
    .filter((filename) => path.extname(filename) === '.mp3')
    .map((filename) => path.basename(filename, '.mp3'))
    .filter((id) => !filesById[id])

  const lastRead = Date.now()

  return Promise.all(
    missingIds.map(async (id) => {
      const contentLength = fs.statSync(path.join(MP3_DIR, `${id}.mp3`)).size
      const file = { id, lastRead, contentLength }
      await files.push(file).write()
      return getFullVideo(file)
    })
  )
}

const read = async (db: DB['db']) => {
  return db
    .get('files')
    .map((v) => getFullVideo(v))
    .value()
}

const get = async (db: DB['db'], id: string) => {
  const file = db.get('files').find({ id }).value()
  if (!file) return null
  return getFullVideo(file)
}

const download = async (
  db: DB['db'],
  id: string,
  download: (id: string) => Promise<unknown>
) => {
  const filepath = path.join(MP3_DIR, `${id}.mp3`)
  await download(filepath)
  const contentLength = fs.statSync(filepath).size
  const updated = await db
    .get('files')
    .push({ id, contentLength, lastRead: Date.now() })
    .write()
  return getFullVideo(updated[0])
}

const peek = async (db: DB['db'], id: string) => {
  const files = db.get('files')
  await files.find({ id }).assign({ lastRead: Date.now() }).write()
}

const teardown = async () => {
  await fs.remove(MP3_DIR)
  await fs.remove(DB_PATH)
}

const createDb = async (): Promise<DB> => {
  const adapter = new FileAsync<Schema>(DB_PATH)

  await fs.ensureDir(MP3_DIR)
  const db = await low(adapter)
  await db.defaults({ files: [] }).write()

  return {
    peek: (id: string) => peek(db, id),
    deleteLRU: (maxSize: number) => deleteLRU(db, maxSize),
    seedLRU: () => seedLRU(db),
    read: () => read(db),
    get: (id: string) => get(db, id),
    download: (id: string, downloader: (id: string) => Promise<unknown>) =>
      download(db, id, downloader),
    teardown: () => teardown(),
    db,
  }
}

export default createDb
