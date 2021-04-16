import execa from 'execa'
import os from 'os'
import fs from 'fs-extra'
import path from 'path'
import gettmdir from 'temp-dir'

// const tmpdir = os.tmpdir()
const tmpdir = gettmdir

const downloadFile = async (id: string, dest: string) => {
  await execa('youtube-dl', [
    '-f',
    'bestaudio',
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '-o',
    `${tmpdir}/%(id)s.%(ext)s`,
    id,
  ])
  await fs.move(path.join(tmpdir, `${id}.mp3`), path.join(dest, `${id}.mp3`))
}

export default downloadFile
