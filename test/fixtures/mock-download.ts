import { EventEmitter } from 'events'

type Mock = (modulePath: string, mocks: Record<string, any>) => any

class MockSpawn extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  constructor(command: string, code: number) {
    super()
    this.stdout = new EventEmitter()
    this.stderr = new EventEmitter()

    setImmediate(() => {
      this.stdout.emit('data', command)
      this.stderr.emit('data', command)
      setImmediate(() => this.emit('close', code))
    })
  }
}

const createMockDownload = (mock: Mock, code: 0 | 1) =>
  mock('../../src/download-file', {
    child_process: {
      spawn: (command: string, args: string[]) =>
        new MockSpawn(`${command} ${args.join(' ')}`, code),
    },
  }).default as (file: string) => Promise<string>

export default createMockDownload
