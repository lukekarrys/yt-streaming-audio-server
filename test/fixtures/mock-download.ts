import { EventEmitter } from 'events'

class MockSpawn extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  constructor(command: string, code: number) {
    super()
    this.stdout = new EventEmitter()
    this.stderr = new EventEmitter()

    setImmediate(() => {
      if (code === 0) {
        this.stdout.emit('data', command)
      } else {
        this.stderr.emit('data', command)
      }
      setImmediate(() => this.emit('close', code))
    })
  }
}

type MockDownload = (
  modulePath: string,
  mocks: Record<string, any>
) => {
  default: (file: string) => Promise<string>
}

const createMockDownload = (mock: MockDownload, code: 0 | 1) =>
  mock('../../src/download-file', {
    child_process: {
      spawn: (command: string, args: string[]) =>
        new MockSpawn(`${command} ${args.join(' ')}`, code),
    },
  }).default

export default createMockDownload
