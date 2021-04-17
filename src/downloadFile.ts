import { spawn } from 'child_process'
import path from 'path'
import { mp3Dir } from './config'

const downloadFile = (
  id: string,
  log: (...args: unknown[]) => void
): Promise<{ output: string }> => {
  const ytLog = (...args: unknown[]) => log('[youtube-dl]', ...args)

  const outputFile = path.join(mp3Dir, `${id}.mp3`)

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
      path.join(mp3Dir, '%(id)s.%(ext)s'),
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
