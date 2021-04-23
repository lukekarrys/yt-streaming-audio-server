import { Server, ServerOptions } from '../../src/server'
import path from 'path'
import fs from 'fs-extra'
import { FIXTURE_DIR } from './index'
import { PathLike } from 'node:fs'

const createBadReadStream = (errMessage?: string) =>
  errMessage
    ? (p: PathLike) => {
        const stream = fs.createReadStream(p)
        setImmediate(() => stream.emit('error', new Error(errMessage)))
        return stream
      }
    : fs.createReadStream

const createCopyFixture = (idToCopy?: string) => async (outputFile: string) => {
  if (idToCopy) {
    await fs.copy(path.resolve(FIXTURE_DIR, `${idToCopy}.mp3`), outputFile)
    return outputFile
  } else if (idToCopy === 'error') {
    throw new Error('Could not download file')
  } else {
    return outputFile
  }
}

type MockServer = (
  modulePath: string,
  mocks: Record<string, any>
) => {
  default: (options?: ServerOptions) => Promise<Server>
}

const mockServer = (
  mock: MockServer,
  {
    idToCopy,
    readStreamError,
  }: { idToCopy?: string; readStreamError?: string } = {}
) =>
  mock('../../src/server', {
    '../../src/download-file': createCopyFixture(idToCopy),
    '../../src/debug': {
      log: () => {},
      error: () => {},
    },
    'fs-extra': {
      ...fs,
      createReadStream: createBadReadStream(readStreamError),
    },
  }).default

export default mockServer
