import execa from 'execa'

const downloadFile = async (id: string, dest: string) => {
  const tmpPath = `${process.cwd()}/mp3/%(id)s.%(ext)s`

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

  console.log('stdout:', stdout)
  console.log('stderr:', stderr)
}

export default downloadFile
