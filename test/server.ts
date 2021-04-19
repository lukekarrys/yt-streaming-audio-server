import tap from 'tap'
import fetch, { Headers, HeadersInit } from 'node-fetch'
import { Server } from '../src/server'
import createMockServer from './fixtures/mock-server'
import { IDS, setupFixtures, generateFixturesById } from './fixtures'

let serverHandler: Server | null = null

tap.beforeEach(async () => {
  await setupFixtures()
  serverHandler = await createMockServer(tap.mock)()
})

tap.afterEach(async () => {
  serverHandler = serverHandler!
  await serverHandler.db.teardown()
  serverHandler.close()
})

const get = async (
  path = '',
  headers?: HeadersInit
): Promise<{
  status: number
  headers: Headers
  data: Buffer | {}
}> => {
  serverHandler = serverHandler!
  const res = await fetch(`http://localhost:${serverHandler.port}${path}`, {
    headers,
  })
  const data = await res[res.status.toString()[0] === '2' ? 'buffer' : 'json']()
  return {
    status: res.status,
    headers: res.headers,
    data,
  }
}

tap.test('Serves errors', async (t) => {
  t.ok(serverHandler)
  serverHandler = serverHandler!

  const res1 = await get()
  t.equal(res1.status, 404)
  t.strictSame(res1.data, { error: 'Not found' })

  const res2 = await get('/mp3')
  t.equal(res2.status, 404)
  t.strictSame(res2.data, { error: 'Not found' })

  const res3 = await get('/mp3?id=')
  t.equal(res3.status, 404)
  t.strictSame(res3.data, { error: 'Not found' })

  const res4 = await get('/mp3?id=1')
  t.equal(res4.status, 404)
  t.strictSame(res4.data, { error: 'Not found' })

  const res5 = await get(`/mp33?id=${IDS.a}`)
  t.equal(res5.status, 404, 'A valid id but bad path')
  t.strictSame(res4.data, { error: 'Not found' })
})

tap.test('Serves a full file with a 200', async (t) => {
  t.ok(serverHandler)
  serverHandler = serverHandler!

  const fixtures = generateFixturesById({})
  const fixture = fixtures[IDS.a]
  const res1 = await get(`/mp3?id=${fixture.id}`)

  t.equal(res1.status, 200)
  t.equal(res1.headers.get('content-type'), 'audio/mpeg')
  t.equal(res1.headers.get('content-range'), null)
  t.equal(res1.headers.get('accept-ranges'), null)
  t.equal(res1.headers.get('content-type'), 'audio/mpeg')
  t.same(res1.headers.get('content-length'), fixture.contentLength)
  t.equal(
    res1.data instanceof Buffer && Buffer.byteLength(res1.data),
    fixture.contentLength
  )
})

tap.test('Serves a partial file with a 206', async (t) => {
  t.ok(serverHandler)
  serverHandler = serverHandler!

  const fixtures = generateFixturesById({})
  const fixture = fixtures[IDS.a]

  const res1 = await get(`/mp3?id=${fixture.id}`, {
    range: 'bytes=0-10',
  })

  t.equal(res1.status, 206)
  t.equal(res1.headers.get('content-type'), 'audio/mpeg')
  t.equal(
    res1.headers.get('content-range'),
    `bytes 0-10/${fixture.contentLength}`
  )
  t.equal(res1.headers.get('accept-ranges'), 'bytes')
  t.same(res1.headers.get('content-length'), 11)
  t.equal(res1.data instanceof Buffer && Buffer.byteLength(res1.data), 11)
})

tap.test(
  'Serves a partial file with a 206 with an open ended range',
  async (t) => {
    t.ok(serverHandler)
    serverHandler = serverHandler!

    const fixtures = generateFixturesById({})
    const fixture = fixtures[IDS.a]

    const res1 = await get(`/mp3?id=${fixture.id}`, {
      range: 'bytes=20-',
    })

    t.equal(res1.status, 206)
    t.equal(res1.headers.get('content-type'), 'audio/mpeg')
    t.equal(
      res1.headers.get('content-range'),
      `bytes 20-${fixture.contentLength - 1}/${fixture.contentLength}`
    )
    t.equal(res1.headers.get('accept-ranges'), 'bytes')
    t.same(res1.headers.get('content-length'), fixture.contentLength - 20)
    t.equal(
      res1.data instanceof Buffer && Buffer.byteLength(res1.data),
      fixture.contentLength - 20
    )

    const res2 = await get(`/mp3?id=${fixture.id}`, {
      range: 'bytes=-20',
    })

    t.equal(res2.status, 206)
    t.equal(res2.headers.get('content-type'), 'audio/mpeg')
    t.equal(
      res2.headers.get('content-range'),
      `bytes 0-20/${fixture.contentLength}`
    )
    t.equal(res2.headers.get('accept-ranges'), 'bytes')
    t.same(res2.headers.get('content-length'), 21)
    t.equal(res2.data instanceof Buffer && Buffer.byteLength(res2.data), 21)
  }
)
