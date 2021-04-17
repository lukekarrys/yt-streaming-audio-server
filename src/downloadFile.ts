import { spawn } from 'child_process'
import path from 'path'
import { MP3_DIR } from './config'
import isValidId from './validId'

const downloadFile = (
  id: string,
  log: (...args: unknown[]) => void
): Promise<{ output: string }> => {
  // Double check that its a valid id so we are less likely to
  // accidentally pass something arbitrary to spawn
  isValidId(id)

  const ytLog = (...args: unknown[]) => log('[youtube-dl]', ...args)

  const outputFile = path.join(MP3_DIR, `${id}.mp3`)

  ytLog(`downloading to ${outputFile}`)

  return new Promise((resolve, reject) => {
    const errors: string[] = []

    const cmd = spawn('youtube-dl', [
      '-f',
      'bestaudio',
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '-o',
      path.join(MP3_DIR, '%(id)s.%(ext)s'),
      id,
    ])

    cmd.stdout.on('data', (d) => log(d.toString().trim()))
    cmd.stderr.on('data', (d) => errors.push(d.toString().trim()))
    cmd.on('close', (code) =>
      code === 0
        ? resolve({ output: outputFile })
        : reject(new Error(errors.join('\n')))
    )
  })
}

export default downloadFile
