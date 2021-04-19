import tap from 'tap'
import fs from 'fs-extra'
import path from 'path'
import createDb, { DB } from '../src/db'
import {
  IDS,
  generateFixtures,
  setupFixtures,
  FIXTURE_DIR,
} from './fixtures/index'

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

tap.beforeEach(async () => {
  await setupFixtures()
  db = await createDb()
})

tap.afterEach(async () => {
  db = db!
  await db.teardown()
  db = null
})

tap.test('Seeds a database', async (t) => {
  t.ok(db)
  db = db!

  t.strictSame(db.db.get('files').value(), [], 'Before seeding files is empty')

  const { lastRead, seeded } = await seedDb(db, Date.now())

  t.strictSame(
    seeded,
    generateFixtures({ lastRead }),
    'After seeding files is equal to files'
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
        id: IDS.a,
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
        id: IDS.a,
        lastRead,
      },
      {
        id: IDS.b,
        lastRead,
      },
      {
        id: IDS.c,
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
  await db.peek(IDS.c)
  reset()

  await wait(10)
  await db.peek(IDS.a)
  await wait(10)
  await db.peek(IDS.b)

  const { deleted } = await db.deleteLRU(total - 1)
  t.strictSame(
    deleted,
    generateFixtures([
      {
        id: IDS.c,
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

  await db.download(IDS.d, (filepath) =>
    fs.copy(path.resolve(FIXTURE_DIR, `${IDS.a}.mp3`), filepath)
  )

  const lastReadD = Date.now()
  const reset = mockDateNow(lastReadD)
  await db.peek(IDS.d)
  reset()

  const all = await db.read()

  t.strictSame(
    all,
    [
      ...generateFixtures({ lastRead }),
      ...generateFixtures([{ id: IDS.a, lastRead: lastReadD }]).map((f) => ({
        ...f,
        id: IDS.d,
        path: f.path.replace(`${IDS.a}.mp3`, `${IDS.d}.mp3`),
      })),
    ],
    'Deletes the least recently used file since the others were read'
  )
})

tap.test('Can get a file', async (t) => {
  t.ok(db)
  db = db!

  const { lastRead } = await seedDb(db, Date.now())

  const a = await db.get(IDS.a)
  const empty = await db.get('sdfsdfs')

  t.strictSame(a, generateFixtures([{ id: IDS.a, lastRead }])[0])
  t.equal(empty, null)
})
