import tap from 'tap'
import HTTPError from '../src/error'

tap.test('Makes and error with a status code', (t) => {
  const message = 'message'
  const status = 404
  const err = new HTTPError(message, status, '')
  t.equal(err.message, message)
  t.equal(err.status, status)
  t.end()
})

tap.test('Captures a secondary message and turns it into an error', (t) => {
  const message = 'Another error message'
  const err = new HTTPError('message', 404, message)
  t.strictSame(err.originalError, new Error(message))
  t.end()
})

tap.test('Captures a secondary message and turns it into an error', (t) => {
  const otherErr = new Error('Another error message')
  const err = new HTTPError('message', 404, otherErr)
  t.equal(err.originalError, otherErr)
  t.end()
})
