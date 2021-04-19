import tap from 'tap'
import fetch from 'node-fetch'
import createMockServer from './fixtures/server'
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

tap.test('Downloads a file but errors', async (t) => {
  const server = await createMockServer(t.mock)()

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
      readStreamError: true,
    })()

    const res1 = await fetch(`http://localhost:${server.port}/mp3?id=${IDS.d}`)
    const data = await res1.json()

    t.equal(res1.status, 500)
    t.strictSame(data, { error: 'An unknown error occurred' })

    await server.db.teardown()
    server.close()
  }
)
