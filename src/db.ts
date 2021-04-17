import low, { lowdb } from 'lowdb'
import FileAsync from 'lowdb/adapters/FileAsync'
import path from 'path'
import { MP3_DIR } from './config'
import fs from 'fs-extra'
import bytes from 'bytes'

type Video = { id: string; lastRead: number; contentLength: number }
type VideoLastRead = Video & { lastReadDate: Date; contentLengthHuman: string }
type Schema = { videos: Video[] }

export type DB = {
  peek: (id: string, length: number) => Promise<void>
  deleteLRU: (maxSize: number, dry?: boolean) => Promise<VideoLastRead[]>
  seedLRU: (dry?: boolean) => Promise<VideoLastRead[]>
  db: low.LowdbAsync<Schema>
}

const videoLastRead = (video: Video): VideoLastRead => ({
  ...video,
  contentLengthHuman: bytes.format(video.contentLength),
  lastReadDate: new Date(video.lastRead),
})

const deleteLRU = async (
  db: DB['db'],
  maxSize: number,
  dry?: boolean
): Promise<VideoLastRead[]> => {
  const videos = db.get('videos')

  const total = videos
    .reduce((acc, video) => acc + video.contentLength, 0)
    .value()

  const toDelete: Video[] = []

  if (total > maxSize) {
    const amountOver = total - maxSize
    const leastRecent = videos.orderBy('lastRead', 'asc').value()

    let sum = 0

    for (const video of leastRecent) {
      sum += video.contentLength
      toDelete.push(video)
      if (sum > amountOver) {
        break
      }
    }
  }

  return Promise.all(
    toDelete.map(async (video) => {
      if (!dry) {
        await fs.remove(path.join(MP3_DIR, `${video.id}.mp3`))
        await videos.remove({ id: video.id }).write()
      }
      return videoLastRead(video)
    })
  )
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
      if (!dry) {
        await videos.push(video).write()
      }
      return videoLastRead(video)
    })
  )
}

const peek = async (db: DB['db'], id: string, contentLength: number) => {
  const videos = db.get('videos')
  const update = { lastRead: Date.now(), contentLength }
  const video = { id }

  const operation = videos.find(video).value()
    ? videos.find(video).assign(update)
    : videos.push({ ...video, ...update })

  await operation.write()
}

const createDb = async (): Promise<DB> => {
  const adapter = new FileAsync<Schema>(
    path.resolve(__dirname, '..', 'db.json')
  )

  const db = await low(adapter)
  await db.defaults({ videos: [] }).write()

  return {
    peek: (id: string, contentLength: number) => peek(db, id, contentLength),
    deleteLRU: (maxSize: number, dry?: boolean) => deleteLRU(db, maxSize, dry),
    seedLRU: (dry?: boolean) => seedLRU(db, dry),
    db,
  }
}

export default createDb
