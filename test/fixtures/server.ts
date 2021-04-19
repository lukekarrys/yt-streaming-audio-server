import { Server, ServerOptions } from '../../src/server'
import path from 'path'
import fs from 'fs-extra'
import { FIXTURE_DIR } from './index'
import { PathLike } from 'node:fs'

type Mock = (modulePath: string, mocks: Record<string, any>) => any

const mockServer = (
  mock: Mock,
  {
    idToCopy,
    readStreamError,
  }: { idToCopy?: string; readStreamError?: boolean } = {}
) =>
  mock('../../src/server', {
    '../../src/download-file': async (outputFile: string) => {
      if (idToCopy) {
        await fs.copy(path.resolve(FIXTURE_DIR, `${idToCopy}.mp3`), outputFile)
        return outputFile
      } else {
        throw new Error('Could not download file')
      }
    },
    'fs-extra': {
      ...fs,
      createReadStream: readStreamError
        ? (p: PathLike) => {
            console.log('i made a stream', p)
            const stream = fs.createReadStream(p)
            setImmediate(() => stream.emit('error', new Error('mock error')))
            // @ts-ignore
            stream.pipe = () => {}
            return stream
          }
        : fs.createReadStream,
    },
  }).default as (options?: ServerOptions) => Promise<Server>

export default mockServer
