// Compare Vimeo, DB, and disk, and mark missing DB entries for re-download
module.exports.compareVimeoDbDisk = async (downloadDir, vimeoUtil, databaseUtil) => {
  const fs = require('fs');
  const path = require('path');
  // 1. Fetch all videos from Vimeo
  const vimeoVideos = await require('./vimeo').fetchAndInsert().then(() => databaseUtil.findAll());
  // 2. Get all DB videos
  const dbVideos = await databaseUtil.findAll();
  // 3. Get all files on disk
  let diskFiles = [];
  try {
    diskFiles = fs.readdirSync(downloadDir).filter(f => f.endsWith('.mp4'));
  } catch (e) {
    logger.error('Could not read download directory: ' + e);
    return;
  }
  // 4. Find missing in DB (Vimeo videos not in DB)
  const dbResourceKeys = new Set(dbVideos.map(v => v.resource_key));
  const vimeoResourceKeys = new Set(vimeoVideos.map(v => v.resource_key));
  const missingInDb = vimeoVideos.filter(v => !dbResourceKeys.has(v.resource_key));

  // 5. Find missing on disk (Vimeo videos not present as files on disk)
  const normalizeFilename = (filename) => filename.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const diskFileSet = new Set(diskFiles.map(normalizeFilename));
  const missingOnDiskFromVimeo = vimeoVideos.filter(v => {
    if (!v.path) {
      console.warn(`Warning: Vimeo video with resource_key ${v.resource_key} has an undefined path.`);
      return false;
    }
    const normalizedPath = normalizeFilename(path.basename(v.path));
    const isMissing = !diskFileSet.has(normalizedPath);
    if (isMissing) {
      console.debug(`Video marked as missing: ${v.name} (Expected path: ${normalizedPath})`);
    } else {
      console.debug(`Video exists on disk: ${v.name} (Path: ${normalizedPath})`);
    }
    return isMissing;
  });

  // 6. Print summary
  console.log(`\nVimeo videos: ${vimeoVideos.length}`);
  console.log(`DB videos: ${dbVideos.length}`);
  console.log(`Files on disk: ${diskFiles.length}`);
  console.log(`\nMissing in DB: ${missingInDb.length}`);
  if (missingInDb.length) missingInDb.forEach(v => console.log(v.name));
  console.log(`\nMissing on disk (from Vimeo): ${missingOnDiskFromVimeo.length}`);
  if (missingOnDiskFromVimeo.length) missingOnDiskFromVimeo.forEach(v => console.log(v.name));

  // 7. Mark missing in DB for re-download
  for (const v of missingInDb) {
    await databaseUtil.upsert(Object.assign({}, v, { status: 'not_downloaded' }));
  }

  // Mark missing on disk (from Vimeo) for re-download
  for (const v of missingOnDiskFromVimeo) {
    await databaseUtil.upsert(Object.assign({}, v, { status: 'not_downloaded' }));
  }
  console.log(`\nMarked ${missingInDb.length} missing-in-DB videos for download.`);
  console.log(`Marked ${missingOnDiskFromVimeo.length} missing-on-disk videos for download.`);
};
// Mark DB videos as download_failed if their file is missing on disk
module.exports.markMissingFilesForRedownload = async (downloadDir, databaseUtil) => {
  const fs = require('fs');
  const path = require('path');
  const videos = await require('./database').findAll();
  const downloadedVideos = videos.filter(v => v.status === 'downloaded' && v.path);
  let changed = 0;
  for (const video of downloadedVideos) {
    const file = path.basename(video.path);
    const filePath = path.join(downloadDir, file);
    if (!fs.existsSync(filePath)) {
      await databaseUtil.markVideoAsDowloadFailed(video);
      changed++;
    }
  }
  console.log(`\nMarked ${changed} missing files for re-download.`);
};
const colors = require('colors')
const pretty = require('prettysize')
const sugar = require('sugar/string').String
const { table } = require('table')

const { logger } = require('../logger')

const { findAll } = require('./database')
const { getBestDownloadOption, sortBySize } = require('./video')

const printVideos = videos => {
  const data = [ ['Name', 'Status', 'Size'] ]

  let totalSize = 0

  videos.forEach(video => {
    const name = sugar.truncate(video.name.replace(/[\u0001-\u001A]/g, ''), process.stdout.columns - 36)
    const size = getBestDownloadOption(video).size

    totalSize += size

    let status = sugar.titleize(video.status)

    switch (true) {
      case status.includes('Failed'): status = colors.red(status)
        break
      case status.includes('Not'):
        break
      case status.includes('ing'): status = colors.yellow(status)
        break
      case status.includes('ed'): status = colors.green(status)
        break
    }

    data.push([name, status, pretty(size)])
  })

  console.log(table(data))

  logger.info(`Total size: ${pretty(totalSize)} (${videos.length} videos)`)
}

module.exports.all = () => findAll().then(videos => sortBySize(videos)).then(videos => printVideos(videos))

// Print DB/disk comparison for downloaded videos
module.exports.compareDbAndDisk = async (downloadDir) => {
  const fs = require('fs');
  const path = require('path');
  const videos = await findAll();
  const downloadedVideos = videos.filter(v => v.status === 'downloaded' && v.path);
  const dbFiles = downloadedVideos.map(v => {
    if (!v.path) {
      console.warn(`Warning: Video with resource_key ${v.resource_key} has an undefined path.`);
      return null;
    }
    return path.basename(v.path);
  }).filter(Boolean); // Filter out null values

  let diskFiles = [];
  try {
    diskFiles = fs.readdirSync(downloadDir).filter(f => f.endsWith('.mp4'));
  } catch (e) {
    logger.error('Could not read download directory: ' + e);
    return;
  }

  // Files in DB but missing on disk
  const missingOnDisk = dbFiles.filter(f => !diskFiles.includes(f));
  // Files on disk but not in DB
  const orphanOnDisk = diskFiles.filter(f => !dbFiles.includes(f));

  console.log('\n=== DB videos with status:downloaded but missing on disk ===');
  if (missingOnDisk.length) {
    missingOnDisk.forEach(f => console.log(f));
  } else {
    console.log('None!');
  }

  console.log('\n=== Files on disk not in DB (orphans) ===');
  if (orphanOnDisk.length) {
    orphanOnDisk.forEach(f => console.log(f));
  } else {
    console.log('None!');
  }

  console.log(`\nDB downloaded videos: ${dbFiles.length}`);
  console.log(`Files on disk: ${diskFiles.length}`);
};
