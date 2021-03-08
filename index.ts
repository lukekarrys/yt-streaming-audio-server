import http, { IncomingMessage, ServerResponse } from 'http'
import ms from 'mediaserver'
import path from 'path'
import { URL } from 'url'

const port = process.env.PORT || 3000

const error = (
  res: ServerResponse,
  status: number = 500,
  e: Error | string = 'An unknown error occurred'
) => {
  console.log(`Error: ${status} ${e}`)
  res.writeHead(status)
  res.end(
    JSON.stringify({
      error: e instanceof Error ? e.message : e,
    })
  )
}

const ABSOLUTE_URL = 'http://a.a'
const parseUrl = (req: IncomingMessage) => new URL(req.url || '', ABSOLUTE_URL)
const strUrl = (url: URL) => url.toString().replace(ABSOLUTE_URL, '')

http
  .createServer((req, res) => {
    try {
      const { method } = req
      const parsedUrl = parseUrl(req)

      console.log(`${method}: ${strUrl(parsedUrl)}`)

      const id = parsedUrl.searchParams.get('id')
      if (!id) {
        return error(res, 400, 'No id')
      }

      if (parsedUrl.pathname === '/mp3' && method === 'GET' && id) {
        console.log(`Streaming: ${id} ${req.headers.range}`)
        return ms.pipe(req, res, path.resolve(__dirname, 'mp3', `${id}.mp3`))
      }

      return error(res, 404, 'Not found')
    } catch (e) {
      console.log('Unknown error', e)
      return error(res, 500, 'An unknown error occurred')
    }
  })
  .listen(port, () => console.log(`Listening on ${port}`))
