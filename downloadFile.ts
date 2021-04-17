import { spawn } from 'child_process'
import { mp3Dir } from './config'

const downloadFile = (id: string) =>
  new Promise((resolve, reject) => {
    const outputPath = `${mp3Dir}/%(id)s.%(ext)s`

    console.log(`Downloading to ${outputPath}`)

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

    cmd.stdout.on('data', (d) => process.stdout.write(d.toString()))
    cmd.stderr.on('data', (d) => process.stderr.write(d.toString()))
    cmd.on('close', (code) =>
      !code ? resolve('Success') : reject(`Exited with code ${code}`)
    )
  })

export default downloadFile
