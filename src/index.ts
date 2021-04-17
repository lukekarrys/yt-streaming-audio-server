import http, { IncomingMessage, ServerResponse } from 'http'
import streamAudio from './streamAudio'
import path from 'path'
import { URL } from 'url'
import fs from 'fs-extra'
import downloadFile from './downloadFile'
import { MP3_DIR } from './config'
import HTTPError from './error'
import isValidId from './validId'

const port = process.env.PORT || 3000

const ABSOLUTE_URL = 'http://a.a'
const parseUrl = (req: IncomingMessage) => new URL(req.url || '', ABSOLUTE_URL)
const strUrl = (url: URL) => url.toString().replace(ABSOLUTE_URL, '')

http
  .createServer(async (req, res) => {
    const { method } = req
    const parsedUrl = parseUrl(req)
    const randomId = Math.random().toString().slice(2, 6)
    const reqId = `[${randomId}-${method}-${strUrl(parsedUrl)}]`

    const logRequest = (...args: unknown[]) =>
      console.log('[request]', reqId, ...args)
    const logRequestError = (...args: unknown[]) =>
      console.error('[error]', reqId, ...args)

    try {
      logRequest()

      const id = parsedUrl.searchParams.get('id')

      if (parsedUrl.pathname === '/mp3' && method === 'GET' && isValidId(id)) {
        const mp3Path = path.join(MP3_DIR, `${id}.mp3`)
        const mp3Exists = await fs.pathExists(mp3Path)

        if (!mp3Exists) {
          logRequest(`cached file not found: ${mp3Path}`)
          await downloadFile(id, logRequest)
        }

        const stream = streamAudio(req, res, mp3Path)
        logRequest(`streaming: ${stream.join(',')}`)
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
  })
  .listen(port, () => console.log('[server]', `Listening on ${port}`))
