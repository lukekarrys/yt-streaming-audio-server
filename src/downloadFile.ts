import { spawn } from 'child_process'
import { mp3Dir } from './config'

const log = (...args: unknown[]) => console.log('[youtube-dl]', ...args)

const downloadFile = (id: string): Promise<{ output: string }> =>
  new Promise((resolve, reject) => {
    const outputPath = `${mp3Dir}/%(id)s.%(ext)s`

    log(`downloading to ${outputPath}`)

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
      outputPath,
      id,
    ])

    cmd.stdout.on('data', (d) => log(d.toString().trim()))
    cmd.stderr.on('data', (d) => errors.push(d.toString().trim()))
    cmd.on('close', (code) =>
      code === 0
        ? resolve({ output: outputPath })
        : reject(new Error(errors.join('\n')))
    )
  })

export default downloadFile
