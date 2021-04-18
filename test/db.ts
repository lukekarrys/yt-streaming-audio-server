import tap, { mock } from 'tap'
import fs from 'fs-extra'
import path from 'path'
import bytes from 'bytes'
import { MP3_DIR, DB_PATH } from '../src/config'
import createDb, { DB, Video, VideoLastRead } from '../src/db'
import fixtures from './fixture.json'

let db: DB | null = null

const mockDateNow = (value: number) => {
  const RealDateNow = Date.now
  Date.now = () => value
  return () => (Date.now = RealDateNow)
}

const seedDb = async (db: DB, lastRead: number) => {
  const reset = mockDateNow(lastRead)
  const seeded = await db.seedLRU()
  reset()
  return { lastRead, seeded }
}

const wait = (time: number) => new Promise((r) => setTimeout(r, time))

const generateFixtures = (
  options: Partial<Video>[] | Partial<Video>
): VideoLastRead[] => {
  return fixtures
    .map((fixture) => {
      const updateFixture = Array.isArray(options)
        ? options.find((option) => fixture.id === option.id)
        : options
      return updateFixture
        ? ({
            ...fixture,
            ...updateFixture,
          } as Video)
        : null
    })

    .filter(<T>(value: T | null | undefined): value is T => {
      return value !== null && value !== undefined
    })
    .map((fixture) => ({
      ...fixture,
      contentLengthHuman: bytes.format(fixture.contentLength),
      lastReadDate: new Date(fixture.lastRead),
    }))
}

tap.beforeEach(async () => {
  await fs.copy(path.resolve(__dirname, 'fixtures'), MP3_DIR)
  db = await createDb()
})

tap.afterEach(async () => {
  await fs.remove(MP3_DIR)
  await fs.remove(DB_PATH)
  db = null
})

tap.test('Seeds a database', async (t) => {
  t.ok(db)
  db = db!

  t.strictSame(
    db.db.get('videos').value(),
    [],
    'Before seeding videos is empty'
  )

  const { lastRead, seeded } = await seedDb(db, Date.now())

  t.strictSame(
    seeded,
    generateFixtures({ lastRead }),
    'After seeding videos is equal to files'
  )
})

tap.test('Deletes largest file first', async (t) => {
  t.ok(db)
  db = db!

  const { lastRead } = await seedDb(db, Date.now())
  const total = generateFixtures({}).reduce(
    (acc, f) => acc + f.contentLength,
    0
  )

  const { deleted } = await db.deleteLRU(total - 1)

  t.strictSame(
    deleted,
    generateFixtures([
      {
        id: 'a',
        lastRead,
      },
    ]),
    'Deletes only the biggest file to make room for one more bytes'
  )
})

tap.test('Does not delete any files when not needed', async (t) => {
  t.ok(db)
  db = db!

  await seedDb(db, Date.now())
  const total = generateFixtures({}).reduce(
    (acc, f) => acc + f.contentLength,
    0
  )

  const { deleted } = await db.deleteLRU(total)
  t.strictSame(
    deleted,
    [],
    'Deletes no files since max size is the same as current total'
  )
})

tap.test('Deletes all files when necessary', async (t) => {
  t.ok(db)
  db = db!

  const { lastRead } = await seedDb(db, Date.now())

  const { deleted } = await db.deleteLRU(1)
  t.strictSame(
    deleted,
    generateFixtures([
      {
        id: 'a',
        lastRead,
      },
      {
        id: 'b',
        lastRead,
      },
      {
        id: 'c',
        lastRead,
      },
    ]),
    'Delete all files'
  )
})

tap.test('Deletes least recently used file', async (t) => {
  t.ok(db)
  db = db!

  await seedDb(db, Date.now())
  const fixtures = generateFixtures({})
  const total = fixtures.reduce((acc, f) => acc + f.contentLength, 0)

  const lastReadC = Date.now()
  const reset = mockDateNow(lastReadC)
  await db.peek('c')
  reset()

  await wait(10)
  await db.peek('a')
  await wait(10)
  await db.peek('b')

  const { deleted } = await db.deleteLRU(total - 1)
  t.strictSame(
    deleted,
    generateFixtures([
      {
        id: 'c',
        lastRead: lastReadC,
      },
    ]),
    'Deletes the least recently used file since the others were read'
  )
})

tap.test('Can add a new file', async (t) => {
  t.ok(db)
  db = db!

  const { lastRead } = await seedDb(db, Date.now())

  // Simulate downloading a new file
  await fs.copy(
    path.resolve(__dirname, 'fixtures', 'a.mp3'),
    path.resolve(MP3_DIR, 'd.mp3')
  )

  const lastReadD = Date.now()
  const reset = mockDateNow(lastReadD)
  await db.peek('d')
  reset()
  const all = await db.read()

  t.strictSame(
    all,
    [
      ...generateFixtures({ lastRead }),
      ...generateFixtures([{ id: 'a', lastRead: lastReadD }]).map((f) => ({
        ...f,
        id: 'd',
      })),
    ],
    'Deletes the least recently used file since the others were read'
  )
})
