import tap from 'tap'
import validId from '../src/validate-id'

tap.test('Validates an id', (t) => {
  t.ok(validId('-----------'))
  t.ok(validId('___________'))
  t.ok(validId('11111111111'))
  t.ok(validId('aaaaaaaaaaa'))
  t.ok(validId('-_a1b2g9_-F'))
  t.end()
})

tap.test('Throws for an invalid id', (t) => {
  t.throws(() => validId(null))
  t.throws(() => validId(''))
  t.throws(() => validId('a'))
  t.throws(() => validId('aaaaaaaaaaaa'))
  t.end()
})
