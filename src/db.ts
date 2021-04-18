import low from 'lowdb'
import FileAsync from 'lowdb/adapters/FileAsync'
import path from 'path'
import { MP3_DIR, DB_PATH } from './config'
import fs from 'fs-extra'
import bytes from 'bytes'

export type Video = { id: string; lastRead: number; contentLength: number }
export type VideoLastRead = Video & {
  lastReadDate: Date
  contentLengthHuman: string
}
type Schema = { videos: Video[] }

export type DB = {
  peek: (id: string) => Promise<Video>
  deleteLRU: (
    maxSize: number
  ) => Promise<{ deleted: VideoLastRead[]; prevTotal: number }>
  seedLRU: () => Promise<VideoLastRead[]>
  read: () => Promise<VideoLastRead[]>
  db: low.LowdbAsync<Schema>
}

const videoLastRead = (video: Video): VideoLastRead => ({
  ...video,
  contentLengthHuman: bytes.format(video.contentLength),
  lastReadDate: new Date(video.lastRead),
})

const deleteLRU = async (db: DB['db'], maxSize: number) => {
  const videos = db.get('videos')

  const total = videos
    .reduce((acc, video) => acc + video.contentLength, 0)
    .value()

  const toDelete: Video[] = []

  if (total > maxSize) {
    const amountOver = total - maxSize
    const leastRecent = videos
      .orderBy(['lastRead', 'contentLength'], ['asc', 'desc'])
      .value()

    let sum = 0

    for (const video of leastRecent) {
      sum += video.contentLength
      toDelete.push(video)
      if (sum >= amountOver) {
        break
      }
    }
  }

  const deleted = await Promise.all(
    toDelete.map(async (video) => {
      await fs.remove(path.join(MP3_DIR, `${video.id}.mp3`))
      await videos.remove({ id: video.id }).write()
      return videoLastRead(video)
    })
  )

  return {
    prevTotal: total,
    deleted,
  }
}

const seedLRU = async (db: DB['db'], dry?: boolean) => {
  const videos = db.get('videos')
  const videosById = videos.groupBy('id').value()
  const files = await fs.readdir(MP3_DIR)

  const missingIds = files
    .filter((filename) => path.extname(filename) === '.mp3')
    .map((filename) => path.basename(filename, '.mp3'))
    .filter((id) => !videosById[id])

  const lastRead = Date.now()

  return Promise.all(
    missingIds.map(async (id) => {
      const contentLength = fs.statSync(path.join(MP3_DIR, `${id}.mp3`)).size
      const video = { id, lastRead, contentLength }
      await videos.push(video).write()
      return videoLastRead(video)
    })
  )
}

const read = async (db: DB['db']) => {
  return db
    .get('videos')
    .map((v) => videoLastRead(v))
    .value()
}

const peek = async (db: DB['db'], id: string) => {
  const videos = db.get('videos')
  const contentLength = fs.statSync(path.join(MP3_DIR, `${id}.mp3`)).size
  const update = { lastRead: Date.now(), contentLength }
  const video = { id }

  const operation = videos.find(video).value()
    ? videos.find(video).assign(update)
    : videos.push({ ...video, ...update })

  await operation.write()

  return videoLastRead({ ...video, ...update })
}

const createDb = async (): Promise<DB> => {
  const adapter = new FileAsync<Schema>(DB_PATH)

  const db = await low(adapter)
  await db.defaults({ videos: [] }).write()

  return {
    peek: (id: string) => peek(db, id),
    deleteLRU: (maxSize: number) => deleteLRU(db, maxSize),
    seedLRU: () => seedLRU(db),
    read: () => read(db),
    db,
  }
}

export default createDb
