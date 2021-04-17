import HTTPError from './error'

const getChars = (startChar: string | number, length: number) => {
  const startCode = startChar.toString().charCodeAt(0)
  return [...Array(length)].map((__, i) => String.fromCharCode(i + startCode))
}

// This is very good programming. I was very bored and reaching
// for a sense of control in my life that I could only exert via
// overengineered solutions to unimportant problems
const ZERO_THE_HERO = 0
const HOW_MANY_DIGITS_IN_BASE_10 = 10
const FIRST_LETTER_IN_MODERN_ENGLIGH = 'a'
const HOW_MANY_LETTERS_IN_MODERN_ENGLISH = 26

// Valid characters in a youtube video id
// there should be 64 of them
const validChars = [
  ...getChars(
    FIRST_LETTER_IN_MODERN_ENGLIGH,
    HOW_MANY_LETTERS_IN_MODERN_ENGLISH
  ),
  ...getChars(
    FIRST_LETTER_IN_MODERN_ENGLIGH.toUpperCase(),
    HOW_MANY_LETTERS_IN_MODERN_ENGLISH
  ),
  ...getChars(ZERO_THE_HERO, HOW_MANY_DIGITS_IN_BASE_10),
  '-_',
].join('')

// It's always 11 characters long
const isValidRegex = new RegExp(`^[${validChars}]{11}$`)

const isValid = (id: string | null): id is string => {
  if (!id || !isValidRegex.test(id)) {
    throw new HTTPError('Not found', 404, `id is invalid: ${id}`)
  }
  return typeof id === 'string'
}

export default isValid
