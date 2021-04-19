const fs = require('fs')
const path = require('path')

module.exports = (testFile) => {
  const srcFile = testFile.replace(/^test/, 'src')
  // All files only cover their exactly named counterpart in src
  if (fs.existsSync(path.join(__dirname, srcFile))) return srcFile
  // All test/server-*.ts files provide coverage for the server
  if (path.basename(testFile).split('-')[0] === 'server') return 'src/server.ts'
  // Otherwise no coverage
  return null
}
