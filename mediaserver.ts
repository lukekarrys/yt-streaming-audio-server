/**
 * mediaserver module for node.js
 *
 * MIT license, Oguz Bastemur 2014-2018
 * MIT license, Luke Karrys 2021
 */

import fs from 'fs'
import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from 'http'
import pathModule from 'path'

const CACHE_STAT = true
const statCache: Record<string, number> = {}

const fileInfo = (path: string): number | null => {
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

type Range = number[]

const getRange = (req: IncomingMessage, total: number): Range => {
  const range = [0, total, 0]
  const rinfo = req.headers ? req.headers.range : null

  if (rinfo) {
    const rloc = rinfo.indexOf('bytes=')
    if (rloc >= 0) {
      const ranges = rinfo.substr(rloc + 6).split('-')
      try {
        range[0] = parseInt(ranges[0])
        if (ranges[1] && ranges[1].length) {
          range[1] = parseInt(ranges[1])
          range[1] = range[1] < 16 ? 16 : range[1]
        }
      } catch (e) {}
    }

    if (range[1] == total) range[1]--

    range[2] = total
  }

  return range
}

export const pipe = (
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  onError: (res: ServerResponse, status: number, e: Error | string) => void
): null | Range => {
  const total = fileInfo(path)

  if (total === null) {
    onError(res, 404, `${path} not found`)
    return null
  }

  const range = getRange(req, total)
  const ext = pathModule.extname(path).toLowerCase()
  const type = { '.mp3': 'audio/mpeg' }[ext]

  if (!type || !type.length) {
    onError(res, 404, `Media format not found for ${pathModule.basename(path)}`)
    res.writeHead(404)
    return null
  }

  const file = fs.createReadStream(path, { start: range[0], end: range[1] })

  res.on('close', () => file.close()) // https://stackoverflow.com/a/9021242
  res.on('end', () => file.close()) // https://stackoverflow.com/a/16897986
  res.on('finish', () => file.close()) // https://stackoverflow.com/a/14093091 - https://stackoverflow.com/a/38057516

  const headers: OutgoingHttpHeaders = {
    'Content-Length': range[1],
    'Content-Type': type,
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'POST, GET, OPTIONS',
  }

  if (range[2]) {
    headers['Accept-Ranges'] = 'bytes'
    headers['Content-Range'] = `bytes ${range[0]}-${range[1]}/${total}`
    headers['Content-Length'] = range[2]

    res.writeHead(206, headers)
  } else {
    res.writeHead(200, headers)
  }

  file.pipe(res)
  file.on('close', () => res.end(0))

  return range
}
