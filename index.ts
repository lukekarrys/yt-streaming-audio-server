import http, { IncomingMessage, ServerResponse } from 'http'
import { pipe } from './mediaserver'
import path from 'path'
import { URL } from 'url'

const port = process.env.PORT || 3000

const error = (
  res: ServerResponse,
  status: number = 500,
  e: Error | string = 'An unknown error occurred',
  privateError?: Error
) => {
  console.log('Error:', status, e)
  if (privateError) {
    console.log('Unknown error:', privateError)
  }
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
      const id = parsedUrl.searchParams.get('id')

      console.log(`${method}: ${strUrl(parsedUrl)}`)

      if (parsedUrl.pathname === '/mp3' && method === 'GET' && id) {
        const mp3 = path.resolve(__dirname, 'mp3', `${id}.mp3`)
        const stream = pipe(req, res, mp3, error)
        if (stream) {
          console.log(`Streaming: ${id} ${stream.join(',')}`)
        }
        return
      }

      return error(res, 404, 'Not found')
    } catch (e) {
      return error(res, 500, 'An unknown error occurred', e)
    }
  })
  .listen(port, () => console.log(`Listening on ${port}`))
