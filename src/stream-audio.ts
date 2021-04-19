import fs from 'fs-extra'
import { IncomingMessage, ServerResponse } from 'http'
import parseRange from 'range-parser'
import { FullMP3 } from './db'

const pipe = (
  req: IncomingMessage,
  res: ServerResponse,
  mp3: Pick<FullMP3, 'contentLength' | 'path'>,
  onError: (err: Error) => void
): number[] => {
  const { contentLength, path } = mp3

  const range = req.headers.range ?? 'bytes=0-'
  const parsedRange = parseRange(contentLength, range, { combine: true })

  // Everything except a single satisfiable range is a 416
  if (
    parsedRange === -1 ||
    parsedRange === -2 ||
    parsedRange.type !== 'bytes' ||
    parsedRange.length !== 1
  ) {
    res.statusCode = 416
    res.end()
    return [0, 0, 0]
  }

  const { start, end } = parsedRange[0]
  const retrievedLength = end - start + 1

  res.statusCode = 200
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Content-Length', retrievedLength)

  if (retrievedLength < contentLength) {
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`)
    res.setHeader('Accept-Ranges', 'bytes')
  }

  const fileStream = fs.createReadStream(path, { start, end })

  fileStream.on('error', (err) => {
    res.removeHeader('Content-Length')
    res.removeHeader('Content-Type')
    res.removeHeader('Content-Range')
    res.removeHeader('Accept-Ranges')
    onError(err)
  })

  res.on('close', () => {
    fileStream.close()
  })

  res.on('finish', () => {
    fileStream.close()
  })

  fileStream.pipe(res)

  return [start, end, contentLength]
}

export default pipe
