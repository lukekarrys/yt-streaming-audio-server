import execa from 'execa'
import os from 'os'
import fs from 'fs-extra'
import path from 'path'

const tmpdir = os.tmpdir()

const downloadFile = async (id: string, dest: string) => {
  const tmpPath = `${tmpdir}/%(id)s.%(ext)s`

  console.log(`Downloading to ${tmpPath}`)

  const { stdout, stderr } = await execa('youtube-dl', [
    '-f',
    'bestaudio',
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '-o',
    tmpPath,
    id,
  ])

  console.log('stdout', stdout)
  console.log('stderr', stderr)

  await fs.move(path.join(tmpdir, `${id}.mp3`), path.join(dest, `${id}.mp3`))
}

export default downloadFile
