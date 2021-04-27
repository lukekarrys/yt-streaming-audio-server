import tap from 'tap'
import fetch from 'node-fetch'
import createMockServer from './fixtures/mock-server'
import {
  IDS,
  setupFixtures,
  generateFixturesById,
  generateFixtures,
} from './fixtures'

const mockDateNow = (value: number) => {
  const RealDateNow = Date.now
  Date.now = () => value
  return () => (Date.now = RealDateNow)
}

tap.beforeEach(async () => {
  await setupFixtures()
})

tap.test('Downloads a file that doesnt exist', async (t) => {
  const lastRead = Date.now()
  let reset = mockDateNow(lastRead)
  const server = await createMockServer(t.mock, { idToCopy: IDS.a })()
  reset()

  const fixtures = generateFixturesById({ lastRead })
  const fixture = fixtures[IDS.a]

  const lastReadD = Date.now()
  reset = mockDateNow(lastReadD)
  const res1 = await fetch(`http://localhost:${server.port}/mp3?id=${IDS.d}`)
  reset()

  t.equal(res1.status, 200)
  t.equal(res1.headers.get('content-type'), 'audio/mpeg')
  t.equal(res1.headers.get('content-range'), null)
  t.equal(res1.headers.get('accept-ranges'), null)
  t.equal(res1.headers.get('content-type'), 'audio/mpeg')
  t.same(res1.headers.get('content-length'), fixture.contentLength)

  const data = await res1.buffer()

  t.equal(
    data instanceof Buffer && Buffer.byteLength(data),
    fixture.contentLength
  )

  t.strictSame(
    await server.db.get(IDS.d),
    generateFixtures([{ id: IDS.a, lastRead: lastReadD }]).map((f) => ({
      ...f,
      id: IDS.d,
      path: f.path.replace(`${IDS.a}.mp3`, `${IDS.d}.mp3`),
    }))[0]
  )

  await server.db.teardown()
  server.close()
})

tap.test(
  'Returns the same response on cache route whether file exists already or not',
  async (t) => {
    const server = await createMockServer(t.mock, { idToCopy: IDS.a })()

    // Non existing file
    const res1 = await fetch(
      `http://localhost:${server.port}/cache?id=${IDS.d}`
    )
    const data1 = await res1.text()

    // File does not exist yet even though we have a response since
    // this path exists to fire off a download for a file but return immediately
    const dExists = await server.db.get(IDS.d)
    t.equal(dExists, null)

    // Existing file
    const res2 = await fetch(
      `http://localhost:${server.port}/cache?id=${IDS.b}`
    )
    const data2 = await res2.text()

    t.equal(res1.status, 200)
    t.equal(res1.headers.get('content-type'), 'text/plain')
    t.equal(data1, 'ok')

    t.equal(res2.status, 200)
    t.equal(res2.headers.get('content-type'), 'text/plain')
    t.equal(data2, 'ok')

    await new Promise((resolve, reject) => {
      const start = Date.now()
      const intervalId = setInterval(async () => {
        const dExistsNow = await server.db.get(IDS.d)
        if (Date.now() - start > 5000) {
          reject(new Error('Took too long'))
        } else if (dExistsNow) {
          resolve(dExistsNow)
          clearInterval(intervalId)
        }
      }, 100)
    })

    await server.db.teardown()
    server.close()
  }
)

tap.test(
  'Logs an error if error happens while trying to cache a file',
  async (t) => {
    const server = await createMockServer(t.mock, { idToCopy: 'error' })()

    const res = await fetch(`http://localhost:${server.port}/cache?id=${IDS.d}`)
    const data = await res.text()

    t.equal(res.status, 200)
    t.equal(data, 'ok')
    t.equal(server.errors[0][3], 'Could not download file')

    await server.db.teardown()
    server.close()
  }
)

tap.test('Downloads a file but errors', async (t) => {
  const server = await createMockServer(t.mock, { idToCopy: 'error' })()

  const res1 = await fetch(`http://localhost:${server.port}/mp3?id=${IDS.d}`)
  const data = await res1.json()

  t.equal(res1.status, 500)
  t.strictSame(data, { error: 'An unknown error occurred' })

  await server.db.teardown()
  server.close()
})

tap.test(
  'Downloads a file successfully but stream read is an error',
  async (t) => {
    const server = await createMockServer(t.mock, {
      idToCopy: IDS.a,
      readStreamError: 'This is the mock error message',
    })()

    const res1 = await fetch(`http://localhost:${server.port}/mp3?id=${IDS.d}`)
    const data = await res1.json()

    t.equal(res1.status, 500)
    t.strictSame(data, { error: 'An unknown error occurred' })

    await server.db.teardown()
    server.close()
  }
)
