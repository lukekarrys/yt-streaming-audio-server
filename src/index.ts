import http, { IncomingMessage, ServerResponse } from 'http'
import streamAudio from './streamAudio'
import path from 'path'
import { URL } from 'url'
import fs from 'fs-extra'
import ms from 'ms'
import bytes from 'bytes'
import createDb, { DB } from './db'
import downloadFile from './downloadFile'
import { MP3_DIR, MAX_DIR_SIZE, DELETE_LRU_INTERVAL } from './config'
import HTTPError from './error'
import isValidId from './validId'
import prettyMs from 'pretty-ms'
import * as date from 'date-fns'

const PORT = process.env.PORT || 3000

const ABSOLUTE_URL = 'http://a.a'
const parseUrl = (req: IncomingMessage) => new URL(req.url || '', ABSOLUTE_URL)
const strUrl = (url: URL) => url.toString().replace(ABSOLUTE_URL, '')

const requestListener = async (
  db: DB,
  req: IncomingMessage,
  res: ServerResponse
) => {
  const { method } = req
  const parsedUrl = parseUrl(req)
  const randomId = Math.random().toString().slice(2, 6)
  const reqId = `[${randomId}-${method}-${strUrl(parsedUrl)}]`

  const logRequest = (...args: unknown[]) =>
    console.log('[request]', reqId, ...args)

  const logRequestError = (...args: unknown[]) =>
    console.error('[error]', reqId, ...args)

  logRequest()

  const id = parsedUrl.searchParams.get('id')

  try {
    if (parsedUrl.pathname === '/mp3' && method === 'GET' && isValidId(id)) {
      const mp3Path = path.join(MP3_DIR, `${id}.mp3`)
      const mp3Exists = await fs.pathExists(mp3Path)

      if (!mp3Exists) {
        logRequest(`cached file not found: ${mp3Path}`)
        await downloadFile(id, logRequest)
      }

      const stream = streamAudio(req, res, mp3Path)
      logRequest(`streaming: ${stream.join(',')}`)

      // File has been used so update the last read time
      await db.peek(id, stream[stream.length - 1])

      return
    }

    throw new HTTPError(
      'Not found',
      404,
      'Request not matched by path/method/id'
    )
  } catch (error) {
    const status = error instanceof HTTPError ? error.status : 500
    const message =
      error instanceof HTTPError ? error.message : 'An unknown error occurred'

    logRequestError(status, message)

    const internalMessage =
      error instanceof HTTPError
        ? error.originalError?.message
        : error instanceof Error
        ? error.message
        : error

    if (internalMessage) logRequestError(internalMessage)

    res.writeHead(status)
    res.end(JSON.stringify({ error: message }))
  }
}

const ensureDb = async (db: DB) => {
  const log = (...args: unknown[]) => console.log('[db]', ...args)

  // Dont run these in parallel. They need to be sequential so
  // the the db is always seeded before deleting any files
  const seeded = await db.seedLRU()
  log(`seeded ${seeded.length} new files`)
  log('seeded', JSON.stringify(seeded.map((v) => ({ id: v.id }))))

  const { deleted, prevTotal } = await db.deleteLRU(bytes.parse(MAX_DIR_SIZE))
  const totalDeleted = deleted.reduce(
    (acc, video) => acc + video.contentLength,
    0
  )
  const now = Date.now()

  log(`max size is ${MAX_DIR_SIZE}`)
  log(`prev size was ${bytes.format(prevTotal)}`)
  log(`deleted ${deleted.length} files totaling ${bytes.format(totalDeleted)}`)
  log(`new size is ${bytes.format(prevTotal - totalDeleted)}`)
  log(
    'deleted',
    JSON.stringify(
      deleted.map((v) => ({
        id: v.id,
        size: v.contentLengthHuman,
        lastRead: prettyMs(now - v.lastRead),
      }))
    )
  )

  const next = ms(DELETE_LRU_INTERVAL)
  const nextDate = date.format(new Date(Date.now() + next), 'M/d/yy HH:mm:ssXX')
  log(`ensure db every ${DELETE_LRU_INTERVAL}, again at ${nextDate}`)
  setTimeout(() => ensureDb(db), next)
}

const createServer = (port: number, db: DB) => {
  const server = http.createServer((req, res) => requestListener(db, req, res))
  return new Promise((resolve) => server.listen(port, () => resolve(port)))
}

const main = async () => {
  const db = await createDb()

  await ensureDb(db)

  return createServer(+PORT, db).then((port) =>
    console.log('[init]', `Listening on ${port}`)
  )
}

main().catch((err) => {
  console.error('Server could not be started', err)
})
