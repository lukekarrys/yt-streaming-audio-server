import http, { IncomingMessage, ServerResponse } from 'http'
import streamAudio from './streamAudio'
import path from 'path'
import { URL } from 'url'
import fs from 'fs-extra'
import downloadFile from './downloadFile'
import { mp3Dir } from './config'
import HTTPError from './error'

const port = process.env.PORT || 3000

const ABSOLUTE_URL = 'http://a.a'
const parseUrl = (req: IncomingMessage) => new URL(req.url || '', ABSOLUTE_URL)
const strUrl = (url: URL) => url.toString().replace(ABSOLUTE_URL, '')

const log = (...args: unknown[]) => console.log('[request]', ...args)
const logError = (...args: unknown[]) => console.error('[error]', ...args)

http
  .createServer(async (req, res) => {
    try {
      const { method } = req
      const parsedUrl = parseUrl(req)
      const id = parsedUrl.searchParams.get('id')

      log(`${method}: ${strUrl(parsedUrl)}`)

      if (parsedUrl.pathname === '/mp3' && method === 'GET' && id) {
        const mp3Path = path.join(mp3Dir, `${id}.mp3`)
        const mp3Exists = await fs.pathExists(mp3Path)

        if (!mp3Exists) {
          log(`file not found at ${mp3Path}`)
          await downloadFile(id)
        }

        const stream = streamAudio(req, res, mp3Path)
        log(`streaming: ${id} ${stream.join(',')}`)
        return
      }

      throw new HTTPError(
        'Not found',
        404,
        'Request not matched by path or method'
      )
    } catch (error) {
      const status = error instanceof HTTPError ? error.status : 500
      const internalError =
        error instanceof HTTPError
          ? error.originalError
          : error instanceof Error
          ? error
          : null
      const message =
        error instanceof HTTPError ? error.message : 'An unknown error occurred'

      logError('response', status, message)
      if (internalError) {
        logError('internal', internalError.message)
      }

      res.writeHead(status)
      res.end(JSON.stringify({ error: message }))
    }
  })
  .listen(port, () => console.log('[server]', `Listening on ${port}`))
