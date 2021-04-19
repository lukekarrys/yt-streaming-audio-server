/**
 * MIT license
 * https://github.com/bootstrapping-microservices/video-streaming-example/tree/master
 */

import fs from 'fs-extra'
import { IncomingMessage, ServerResponse } from 'http'

import { FullMP3 } from './db'

const getRange = (range?: string): (number | null)[] => {
  let start: number | null = null
  let end: number | null = null

  if (range) {
    const bytesPrefix = 'bytes='
    if (range.startsWith(bytesPrefix)) {
      const bytesRange = range.substring(bytesPrefix.length)
      const parts = bytesRange.split('-')
      if (parts.length === 2) {
        const rangeStart = parts[0] && parts[0].trim()
        if (rangeStart && rangeStart.length > 0) {
          start = parseInt(rangeStart)
        }
        const rangeEnd = parts[1] && parts[1].trim()
        if (rangeEnd && rangeEnd.length > 0) {
          end = parseInt(rangeEnd)
        }
      }
    }
  }

  return [start, end]
}

const getRetrievedLength = (
  start: number | null,
  end: number | null,
  contentLength: number
) => {
  if (start !== null && end !== null) {
    return end + 1 - start
  } else if (start !== null) {
    return contentLength - start
  } else if (end !== null) {
    return end + 1
  }

  return contentLength
}

const pipe = (
  req: IncomingMessage,
  res: ServerResponse,
  mp3: Pick<FullMP3, 'contentLength' | 'path'>,
  onError: (err: Error) => void
): number[] => {
  const { contentLength, path } = mp3

  const range = req.headers.range
  const [start, end] = getRange(range)
  const retrievedLength = getRetrievedLength(start, end, contentLength)
  const served = [start ?? 0, end ?? contentLength - 1, contentLength]

  if (retrievedLength > contentLength) {
    res.statusCode = 416
    res.end()
    return [0, 0, 0]
  }

  res.statusCode = start !== null || end !== null ? 206 : 200

  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Content-Length', retrievedLength)

  if (range !== undefined) {
    res.setHeader(
      'Content-Range',
      `bytes ${served[0]}-${served[1]}/${served[2]}`
    )
    res.setHeader('Accept-Ranges', 'bytes')
  }
  const fileStream = fs.createReadStream(path, {
    start: start ?? undefined,
    end: end ?? undefined,
  })

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

  return served
}

export default pipe
