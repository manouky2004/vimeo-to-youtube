const path = require('path')
const os = require('os')

module.exports = {
  limit: process.env.DOWNLOAD_PARALLEL_VIDEOS || 3,
  dest: typeof process.env.DOWNLOAD_DEST_FOLDER === 'string' && process.env.DOWNLOAD_DEST_FOLDER
    ? path.resolve(__dirname, process.env.DOWNLOAD_DEST_FOLDER)
    : path.join(os.homedir(), 'vimeo-to-youtube', 'files')
}
