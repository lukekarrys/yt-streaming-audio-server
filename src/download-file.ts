import { spawn } from 'child_process'
import path from 'path'
import isValidId from './validate-id'

const downloadFile = (outputFile: string): Promise<string> => {
  const id = path.basename(outputFile, '.mp3')
  return new Promise((resolve, reject) => {
    try {
      // Double check that its a valid id so we are less likely to
      // accidentally pass something arbitrary to spawn
      isValidId(id)
    } catch (err) {
      reject(err)
      return
    }

    const errors: string[] = []
    const logs: string[] = []

    const cmd = spawn('youtube-dl', [
      '-f',
      'bestaudio',
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '-o',
      path.join(path.dirname(outputFile), '%(id)s.%(ext)s'),
      id,
    ])

    cmd.stdout.on('data', (d) => logs.push(d.toString().trim()))
    cmd.stderr.on('data', (d) => errors.push(d.toString().trim()))
    cmd.on('close', (code) =>
      code === 0
        ? resolve(logs.join('\n'))
        : reject(new Error(errors.join('\n')))
    )
  })
}

export default downloadFile
