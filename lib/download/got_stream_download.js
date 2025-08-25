
const fs = require('fs-extra');
let got;

async function getGot() {
  if (!got) {
    got = (await import('got')).default;
  }
  return got;
}

/**
 * Download a file using streaming (supports large files)
 * @param {string} url - The URL to download
 * @param {string} dest - The destination file path
 * @param {function} onProgress - Optional progress callback
 * @returns {Promise<void>}
 */
async function gotStreamDownload(url, dest, onProgress) {
  const got = await getGot();
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(dest);
    let downloaded = 0;
    let total = 0;

    const downloadStream = got.stream(url);

    downloadStream.on('downloadProgress', progress => {
      downloaded = progress.transferred;
      total = progress.total || total;
      if (onProgress && total) {
        onProgress(downloaded, total);
      }
    });

    downloadStream.on('error', err => {
      writeStream.close();
      reject(err);
    });

    writeStream.on('error', err => {
      downloadStream.destroy();
      reject(err);
    });

    writeStream.on('finish', () => {
      resolve();
    });

    downloadStream.pipe(writeStream);
  });
}

module.exports = gotStreamDownload;
