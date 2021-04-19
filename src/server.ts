import http, { IncomingMessage, ServerResponse } from 'http'
import prettyMs from 'pretty-ms'
import * as date from 'date-fns'
import { URL } from 'url'
import ms from 'ms'
import bytes from 'bytes'
import createDb, { DB } from './db'
import downloadFile from './download-file'
import streamAudio from './stream-audio'
import HTTPError from './error'
import isValidId from './validate-id'
import { PORT } from './config'
import * as debug from './debug'

const ABSOLUTE_URL = 'http://a.a'
const parseUrl = (req: IncomingMessage) => new URL(req.url!, ABSOLUTE_URL)
const strUrl = (url: URL) => url.toString().replace(ABSOLUTE_URL, '')

const sendError = (
  res: ServerResponse,
  error: Error,
  log: (...args: unknown[]) => void
) => {
  const status = error instanceof HTTPError ? error.status : 500

  const message =
    error instanceof HTTPError ? error.message : 'An unknown error occurred'

  const internalMessage =
    error instanceof HTTPError ? error.originalError.message : error.message

  log(status, message)
  log(internalMessage)

  res.writeHead(status)
  res.end(JSON.stringify({ error: message }))
}

const requestListener = async (
  db: DB,
  req: IncomingMessage,
  res: ServerResponse
) => {
  const { method } = req
  const parsedUrl = parseUrl(req)
  const randomId = Math.random().toString().slice(2, 6)
  const reqId = `[${randomId}-${method}-${strUrl(parsedUrl)}]`

  const logRequest = debug.log.bind(null, '[request]', reqId)
  const logRequestError = debug.error.bind(null, '[error]', reqId)

  logRequest()

  const id = parsedUrl.searchParams.get('id')

  try {
    if (parsedUrl.pathname === '/mp3' && method === 'GET' && id) {
      try {
        isValidId(id)
      } catch (e) {
        throw new HTTPError('Not found', 404, e)
      }

      let mp3 = await db.get(id)

      if (!mp3) {
        logRequest(`cached file not found: ${id}`)
        mp3 = await db.download(id, async (id) => {
          logRequest('[download]', await downloadFile(id))
        })
      }

      const [start, end, length] = streamAudio(req, res, mp3, (err) => {
        // This happens if the read stream for the file emits an error
        // I couldn't figure out an async/await way to do this so this
        // just sends the error response to the client just like the catch
        // block does. Something something what the heck is the event loop?
        sendError(res, err, logRequestError)
      })
      logRequest(`streaming: ${start}-${end}/${length}`)

      // File has been used so update the last read time
      await db.peek(id)

      return
    }

    throw new HTTPError(
      'Not found',
      404,
      'Request not matched by path/method/id'
    )
  } catch (error) {
    sendError(res, error, logRequestError)
  }
}

const ensureDb = async (
  db: DB,
  { maxDirSize, deleteLRUInterval }: ServerOptions
): Promise<void> => {
  const log = debug.log.bind(null, '[db]')

  // Dont run these in parallel. They need to be sequential so
  // the the db is always seeded before deleting any files
  const seeded = await db.seedLRU()
  log(`seeded ${seeded.length} new files`)
  log('seeded', JSON.stringify(seeded.map((v) => ({ id: v.id }))))

  if (maxDirSize) {
    const { deleted, prevTotal } = await db.deleteLRU(bytes.parse(maxDirSize))
    const totalDeleted = deleted.reduce(
      (acc, file) => acc + file.contentLength,
      0
    )
    const now = Date.now()

    log(`max size is ${maxDirSize}`)
    log(`prev size was ${bytes.format(prevTotal)}`)
    log(
      `deleted ${deleted.length} files totaling ${bytes.format(totalDeleted)}`
    )
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
  }

  if (deleteLRUInterval) {
    const nextDate = date.format(
      new Date(Date.now() + ms(deleteLRUInterval)),
      'M/d/yy HH:mm:ssXX'
    )
    log(`ensure db every ${deleteLRUInterval}, again at ${nextDate}`)
  }
}

export type Server = {
  port: number
  server: http.Server
  db: DB
  close: () => void
}

export type ServerOptions = {
  maxDirSize?: string
  deleteLRUInterval?: string
}

const main = async ({
  maxDirSize,
  deleteLRUInterval,
}: ServerOptions = {}): Promise<Server> => {
  const db = await createDb()

  await ensureDb(db, { maxDirSize, deleteLRUInterval })

  let cancelDb = () => {}
  if (deleteLRUInterval) {
    const ensureDbInterval = setInterval(
      () => ensureDb(db, { maxDirSize, deleteLRUInterval }),
      ms(deleteLRUInterval)
    )
    cancelDb = () => clearInterval(ensureDbInterval)
  }

  const server = http.createServer((req, res) => requestListener(db, req, res))
  const port = +PORT
  await new Promise((resolve) => server.listen(port, () => resolve(server)))

  return {
    port,
    server,
    db,
    close: () => {
      server.close()
      cancelDb()
    },
  }
}

export default main
