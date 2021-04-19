import tap from 'tap'
import path from 'path'
import createMockDownload from './fixtures/mock-download'
import { IDS } from './fixtures'

const command = (filePath: string) => {
  const dir = path.dirname(filePath)
  const id = path.basename(filePath, '.mp3')
  return `youtube-dl -f bestaudio --extract-audio --audio-format mp3 --audio-quality 0 -o ${dir}/%(id)s.%(ext)s ${id}`
}

tap.test('returns correct command when downloading an file', async (t) => {
  const downloadFile = createMockDownload(t.mock, 0)

  const id = IDS.a
  const filePath = `this/is/a/path/to/${id}.mp3`
  const resp = await downloadFile(filePath)

  t.equal(resp, command(filePath))
})

tap.test('rejects an error when downloading with an error', async (t) => {
  const downloadFile = createMockDownload(t.mock, 1)

  const id = IDS.a
  const filePath = `this/is/a/path/to/${id}.mp3`

  t.rejects(downloadFile(filePath), command(filePath))
})

tap.test('rejects with an invalid id', async (t) => {
  const downloadFile = createMockDownload(t.mock, 0)

  const id = 'a'
  const filePath = `this/is/a/path/to/${id}.mp3`

  t.rejects(downloadFile(filePath), `id is invalid: ${id}`)
})
