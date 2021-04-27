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
  if (idToCopy === 'error') {
    throw new Error('Could not download file')
  } else if (idToCopy) {
    await fs.copy(path.resolve(FIXTURE_DIR, `${idToCopy}.mp3`), outputFile)
    return outputFile
  } else {
    return outputFile
  }
}

type MockServer = (
  modulePath: string,
  mocks: Record<string, any>
) => {
  default: (
    options?: ServerOptions
  ) => Promise<Server & { logs: unknown[][]; errors: unknown[][] }>
}

const mockServer = (
  mock: MockServer,
  {
    idToCopy,
    readStreamError,
  }: { idToCopy?: string; readStreamError?: string } = {}
) => {
  const logs: unknown[][] = []
  const errors: unknown[][] = []

  const server = mock('../../src/server', {
    '../../src/download-file': createCopyFixture(idToCopy),
    '../../src/debug': {
      log: (...args: unknown[]) => {
        logs.push(args)
      },
      error: (...args: unknown[]) => {
        errors.push(args)
      },
    },
    'fs-extra': {
      ...fs,
      createReadStream: createBadReadStream(readStreamError),
    },
  }).default

  return async (options?: ServerOptions) => ({
    ...(await server(options)),
    logs,
    errors,
  })
}

export default mockServer
