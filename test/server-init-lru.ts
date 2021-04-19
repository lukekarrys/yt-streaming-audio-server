import tap from 'tap'
import createMockServer from './fixtures/server'
import { setupFixtures } from './fixtures'

const wait = (time: number) => new Promise((r) => setTimeout(r, time))

tap.beforeEach(async () => {
  await setupFixtures()
})

tap.only('Deletes files on init if too big', async (t) => {
  const server = await createMockServer(t.mock)({
    maxDirSize: '0kb',
    deleteLRUInterval: '1d',
  })

  const all = await server.db.read()
  t.strictSame(all, [], 'everything is deleted on init')

  // TODO: test that all requests download a new file after delete on init

  server.close()
  await server.db.teardown()
})

tap.test('Runs interval based on option', async (t) => {
  const server = await createMockServer(t.mock)({
    maxDirSize: '1tb',
    deleteLRUInterval: '1s',
  })

  // Wait some seconds so interval gets run
  await wait(5000)

  const all = await server.db.read()
  t.equal(all.length, 3, 'everything is still there even after multiple runs')

  server.close()
  await server.db.teardown()
})
