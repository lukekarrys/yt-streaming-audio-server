import tap from 'tap'
import http from 'http'
import path from 'path'
import fetch from 'node-fetch'
import { FIXTURE_DIR, generateFixturesById, IDS } from './fixtures'
import { PORT } from '../src/config'
import streamAudio from '../src/stream-audio'

const startServer = (listener: http.RequestListener): Promise<http.Server> =>
  new Promise((resolve) => {
    const server = http.createServer(listener)
    server.listen(PORT, () => resolve(server))
  })

const fetchFile = async (range?: string) => {
  const res = await fetch(`http://localhost:${PORT}`, {
    headers: range ? { range } : {},
  })
  const buffer = await res.buffer()
  return {
    status: res.status,
    headers: [...res.headers.entries()].reduce((acc, [key, value]) => {
      if (key !== 'date') {
        acc[key] = value
      }
      return acc
    }, {} as Record<string, string>),
    byteLength: Buffer.byteLength(buffer),
  }
}

tap.test('Can complete range requests', async (t) => {
  const fixtures = generateFixturesById({})
  const fixture = fixtures[IDS.a]
  const server = await startServer((req, res) => {
    streamAudio(
      req,
      res,
      {
        contentLength: fixture.contentLength,
        path: path.join(FIXTURE_DIR, `${fixture.id}.mp3`),
      },
      (err) => {
        t.bailout('This should not be called ' + err.message)
      }
    )
  })

  const responses = await Promise.all([
    fetchFile(),
    fetchFile('bytes=40-80'),
    fetchFile('bytes=50-'),
    fetchFile('bytes=-100'),
  ])
  const [noRange, fullRange, endRange, startRange] = responses

  t.equal(
    responses.every((r) => r.headers['content-type'] === 'audio/mpeg'),
    true
  )

  t.equal(
    responses.every((r) => r.headers['connection'] === 'close'),
    true
  )

  t.equal(noRange.status, 200)
  t.same(noRange.headers['content-length'], fixture.contentLength)
  t.equal(noRange.byteLength, fixture.contentLength)

  t.equal(fullRange.status, 206)
  t.same(fullRange.headers['content-length'], 41)
  t.equal(fullRange.byteLength, 41)
  t.equal(
    fullRange.headers['content-range'],
    `bytes 40-80/${fixture.contentLength}`
  )

  t.equal(endRange.status, 206)
  t.same(endRange.headers['content-length'], fixture.contentLength - 50)
  t.equal(endRange.byteLength, fixture.contentLength - 50)
  t.equal(
    endRange.headers['content-range'],
    `bytes 50-${fixture.contentLength - 1}/${fixture.contentLength}`
  )

  t.equal(startRange.status, 206)
  t.same(startRange.headers['content-length'], 101)
  t.equal(startRange.byteLength, 101)
  t.equal(
    startRange.headers['content-range'],
    `bytes 0-100/${fixture.contentLength}`
  )

  server.close()
})

tap.test('Returns an error for a file that does not exist', async (t) => {
  const fixtures = generateFixturesById({})
  const fixture = fixtures[IDS.a]
  const server = await startServer((req, res) => {
    streamAudio(
      req,
      res,
      {
        contentLength: fixture.contentLength,
        path: path.join(FIXTURE_DIR, `thisdoesnotexist.mp3`),
      },
      (err) => {
        res.statusCode = 500
        res.end(JSON.stringify({ my_error: err.message }))
      }
    )
  })

  const res = await fetch(`http://localhost:${PORT}`)

  t.equal(res.status, 500)
  t.match(await res.json(), { my_error: /^ENOENT.*thisdoesnotexist\.mp3/ })

  server.close()
})

tap.test('Returns full response on malformed ranges', async (t) => {
  // TODO: should this return a 416? From what I've seen it is ok to
  // return the full file for bad or unsupported ranges. And a 416 should
  // be limited to out of range requests
  const fixtures = generateFixturesById({})
  const fixture = fixtures[IDS.a]
  const server = await startServer((req, res) => {
    streamAudio(
      req,
      res,
      {
        contentLength: fixture.contentLength,
        path: path.join(FIXTURE_DIR, `${fixture.id}.mp3`),
      },
      (err) => {
        t.bailout('This should not be called ' + err.message)
      }
    )
  })

  const multipleRanges = await fetchFile('bytes=40-80, 100-120')

  t.equal(multipleRanges.status, 200)
  t.same(multipleRanges.headers['content-length'], fixture.contentLength)
  t.equal(multipleRanges.byteLength, fixture.contentLength)

  const notBytes = await fetchFile('dogs=0-10')

  t.equal(notBytes.status, 200)
  t.same(notBytes.headers['content-length'], fixture.contentLength)
  t.equal(notBytes.byteLength, fixture.contentLength)

  server.close()
})

tap.test('Returns a 416 for an outside range request', async (t) => {
  const fixtures = generateFixturesById({})
  const fixture = fixtures[IDS.a]
  const server = await startServer((req, res) => {
    streamAudio(
      req,
      res,
      {
        contentLength: fixture.contentLength,
        path: path.join(FIXTURE_DIR, `${fixture.id}.mp3`),
      },
      (err) => {
        t.bailout('This should not be called ' + err.message)
      }
    )
  })

  const outsideRange = await fetchFile('bytes=0-10000')

  t.equal(outsideRange.status, 416)

  server.close()
})
