import bytes from 'bytes'
import path from 'path'
import fs from 'fs-extra'
import { MP3_DIR } from '../../src/config'
import { MP3, FullMP3 } from '../../src/db'
import fixturesData from './fixtures.json'

export const fixtures = fixturesData

export const FIXTURE_DIR = path.resolve(__dirname, 'files')

export const setupFixtures = () => fs.copy(FIXTURE_DIR, MP3_DIR)

export const generateFixtures = (
  options: Partial<MP3>[] | Partial<MP3>
): FullMP3[] => {
  return fixturesData
    .map((fixture) => {
      const updateFixture = Array.isArray(options)
        ? options.find((option) => fixture.id === option.id)
        : options
      return updateFixture
        ? ({
            ...fixture,
            ...updateFixture,
          } as MP3)
        : null
    })
    .filter(<T>(value: T | null | undefined): value is T => {
      return value !== null && value !== undefined
    })
    .map((fixture) => ({
      ...fixture,
      contentLengthHuman: bytes.format(fixture.contentLength),
      lastReadDate: new Date(fixture.lastRead),
      path: path.resolve(MP3_DIR, `${fixture.id}.mp3`),
    }))
}

export const generateFixturesById = (
  options: Partial<MP3>[] | Partial<MP3>
): { [key: string]: FullMP3 } =>
  generateFixtures(options).reduce((acc, fixture) => {
    acc[fixture.id] = fixture
    return acc
  }, {} as { [key: string]: FullMP3 })

export const IDS = {
  a: 'a'.repeat(11),
  b: 'b'.repeat(11),
  c: 'c'.repeat(11),
  d: 'd'.repeat(11),
}
