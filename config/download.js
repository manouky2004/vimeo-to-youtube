const path = require('path')
const os = require('os')

module.exports = {
  limit: process.env.DOWNLOAD_PARALLEL_VIDEOS || 3,
  dest: typeof process.env.DOWNLOAD_DEST === 'string' && process.env.DOWNLOAD_DEST
    ? path.resolve(process.env.DOWNLOAD_DEST)
    : path.join(os.homedir(), 'vimeo-to-youtube', 'files')
}
