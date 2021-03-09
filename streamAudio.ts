/**
 * MIT license
 * https://github.com/bootstrapping-microservices/video-streaming-example/tree/master
 */

import fs from 'fs'
import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from 'http'

const CACHE_STAT = true
const statCache: Record<string, number> = {}

const getFileSize = (path: string): number | null => {
  if (path) {
    if (CACHE_STAT && statCache[path]) {
      return statCache[path]
    } else {
      if (!fs.existsSync(path)) {
        return null
      }
      const stat = fs.statSync(path)
      if (CACHE_STAT) statCache[path] = stat.size

      return stat.size
    }
  }

  return 0
}

const getRange = (req: IncomingMessage): (number | undefined)[] => {
  let start: number | undefined = void 0
  let end: number | undefined = void 0

  const range = req.headers.range
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
  start: number | undefined,
  end: number | undefined,
  contentLength: number
) => {
  let retrievedLength
  if (start !== undefined && end !== undefined) {
    retrievedLength = end + 1 - start
  } else if (start !== undefined) {
    retrievedLength = contentLength - start
  } else if (end !== undefined) {
    retrievedLength = end + 1
  } else {
    retrievedLength = contentLength
  }

  return retrievedLength
}

const pipe = (
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  onError: (
    res: ServerResponse,
    status: number,
    e: Error | string,
    privateError?: Error
  ) => void
): number[] | null => {
  const contentLength = getFileSize(filePath)

  if (contentLength === null) {
    onError(res, 404, `${filePath} not found`)
    return null
  }

  const range = req.headers.range
  const [start, end] = getRange(req)
  const retrievedLength = getRetrievedLength(start, end, contentLength)

  const statusCode = start !== null || end !== null ? 206 : 200

  const headers: OutgoingHttpHeaders = {
    'Content-Type': 'audio/mpeg',
    'Content-Length': retrievedLength,
  }

  if (range !== undefined) {
    headers['Content-Range'] = `bytes ${start || 0}-${
      end || contentLength - 1
    }/${contentLength}`
    headers['Accept-Ranges'] = 'bytes'
  }

  res.writeHead(statusCode, headers)

  const fileStream = fs.createReadStream(filePath, { start, end })

  res.on('close', () => fileStream.close())
  res.on('end', () => fileStream.close())
  res.on('finish', () => fileStream.close()) // https://stackoverflow.com/a/14093091 - https://stackoverflow.com/a/38057516

  fileStream.on('error', (error) =>
    onError(res, 500, `Error reading file ${filePath}.`, error)
  )

  fileStream.pipe(res)

  return [start || 0, end || contentLength - 1, contentLength]
}

export default pipe
