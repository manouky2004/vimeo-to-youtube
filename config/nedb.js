const path = require('path')
const os = require('os')

module.exports = {
  filename: typeof process.env.DB_FILENAME === 'string' && process.env.DB_FILENAME
    ? path.resolve(__dirname, process.env.DB_FILENAME)
    : path.join(os.homedir(), 'vimeo-to-youtube', 'db', 'videos.db'),
  autoload: true
}
