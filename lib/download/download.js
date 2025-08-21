const path = require('path')
const { Observable } = require('rxjs')
const dl = require('download')
const gotStreamDownload = require('./got_stream_download')
const Listr = require('listr')
const pretty = require('prettysize')
const sugar = require('sugar/string').String

const { logger } = require('../logger')
const { databaseUtil, videoUtil } = require('../util')

const { downloadConfig } = require('../../config')

// Scan for 0-byte files and mark as not downloaded
async function scanAndMarkZeroByteFiles(dest) {
  const fs = require('fs');
  const path = require('path');
  const { findAll } = require('../util/database');
  const videos = await findAll();
  let count = 0;
  for (const video of videos) {
    if (video.path && video.status === 'downloaded') {
      try {
        const stats = fs.statSync(video.path);
        if (stats.size === 0) {
          logger.warn(`Found 0-byte file: ${video.path}. Marking for re-download.`);
          await databaseUtil.markVideoAsDowloadFailed(video);
          fs.unlinkSync(video.path);
          count++;
        }
      } catch (e) {
        // Ignore missing files
      }
    }
  }
  if (count > 0) logger.warn(`Marked ${count} 0-byte files for re-download.`);
}

const downloadWorker = ({ video, dest }) => {
  const filename = `${video.name}.mp4`
  const absolutePath = path.join(dest, filename)
  const downloadOption = videoUtil.getBestDownloadOption(video)

  logger.debug(`Download object for '${video.name}'`, downloadOption)

  return {
    title: sugar.truncate(video.name, process.stdout.columns - 6),
    task: () => new Observable(observer =>
      databaseUtil.markVideoAsDowloading(video)
        .then(() => observer.next(`Downloading ${video.name}...`))
        .then(() => {
          // Use got streaming for large files, fallback to original for small files
          const LARGE_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
          if (downloadOption.size && downloadOption.size > LARGE_FILE_SIZE) {
            return gotStreamDownload(downloadOption.link, absolutePath, (transferred, total) => {
              const percent = total ? Math.round((transferred / total) * 100) : 0;
              observer.next(`Downloading... ${percent}% complete (${pretty(transferred)}/${pretty(total)})`);
            });
          } else {
            return dl(downloadOption.link, dest, { filename })
              .on('downloadProgress', progress => observer.next(`Downloading... ${Math.round(progress.percent * 100)}% complete (${pretty(progress.transferred)}/${pretty(progress.total)})`));
          }
        })
        .then(() => databaseUtil.markVideoAsDowloaded(video, absolutePath))
        .then(() => {
          // Check if file is 0 bytes, if so, mark as not downloaded and throw error to trigger retry
          const fs = require('fs');
          try {
            const stats = fs.statSync(absolutePath);
            if (stats.size === 0) {
              logger.warn(`File '${absolutePath}' is 0 bytes. Will retry download.`);
              // Mark as not downloaded so it will be retried
              return databaseUtil.markVideoAsDowloadFailed(video).then(() => {
                fs.unlinkSync(absolutePath);
                throw new Error(`File '${absolutePath}' is 0 bytes after download.`);
              });
            }
          } catch (e) {
            logger.warn(`Could not stat or delete file '${absolutePath}': ${e}`);
          }
          return databaseUtil.markVideoAsDowloaded(video, absolutePath);
        })
        .catch(err => databaseUtil.markVideoAsDowloadFailed(video).then(() => {
          const message = `An error occured while downloading the video '${video.name}': ${err && err.message ? err.message : err}`;
          logger.warn(message);
          try {
            logger.warn('Full error object: ' + JSON.stringify(err, Object.getOwnPropertyNames(err)));
          } catch (e) {
            logger.warn('Full error object (string): ' + String(err));
          }
          if (err && err.stack) logger.warn('Stack trace: ' + String(err.stack));
          observer.error(new Error(message));
        }))
        .then(() => observer.complete())
    )
  }
}


const download = async ({ limit, dest }) => {
  await scanAndMarkZeroByteFiles(dest);
  let totalDownloaded = 0;
  while (true) {
    const videos = await databaseUtil.findVideosToDownload(limit);
    if (videos.length === 0) break;
    logger.debug(`Starting ${videos.length} downloads`);
    await new Listr(videos.map(video => downloadWorker({ video, dest })), { concurrent: 2, exitOnError: false }).run()
      .catch(err => {
        try {
          logger.warn('Download process error: ' + JSON.stringify(err, Object.getOwnPropertyNames(err)));
        } catch (e) {
          logger.warn('Download process error (string): ' + String(err));
        }
        if (err && err.stack) logger.warn('Stack trace: ' + String(err.stack));
      });
    totalDownloaded += videos.length;
  }
  return totalDownloaded;
};

module.exports = download(downloadConfig);
