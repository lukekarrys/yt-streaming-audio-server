class HTTPError extends Error {
  status: number
  originalError: Error

  constructor(message: string, status: number, originalError: Error | string) {
    super(message)
    this.status = status
    this.originalError =
      typeof originalError === 'string'
        ? new Error(originalError)
        : originalError
  }
}

export default HTTPError
