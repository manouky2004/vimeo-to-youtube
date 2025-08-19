const inquirer = require('inquirer')

const { constants } = require('./constants')
const { logger } = require('./logger')
const { databaseUtil, printUtil, vimeoUtil } = require('./util')

logger.info(`Hello ${require('os').userInfo().username}`)

const prompt = () => inquirer.prompt({
  type: 'list',
  name: 'action',
  message: 'What do you want to do?',
  choices: [
    constants.CHOICE_DOWNLOAD,
    // constants.CHOICE_UPLOAD, // Disabled for now
    // constants.CHOICE_TRANSFER, // Disabled for now
  constants.CHOICE_TEST_VIMEO,
  constants.CHOICE_SHOW_VIMEO_COUNT,
    new inquirer.Separator(),
    constants.CHOICE_PRINT_LIST,
    constants.CHOICE_REFRESH,
    constants.CHOICE_RESET_DOWNLOADING,
    new inquirer.Separator(),
    constants.CHOICE_QUIT,
    new inquirer.Separator()
  ]
})
  .then(answer => {
    logger.debug('Question answered', answer)

    switch (answer.action) {
      case constants.CHOICE_DOWNLOAD: require('./download')
        break
      // case constants.CHOICE_UPLOAD:
      //   logger.info('Upload to YouTube is currently disabled.');
      //   break
      // case constants.CHOICE_TRANSFER:
      //   logger.info('Direct transfer to YouTube is currently disabled.');
      //   break
      case constants.CHOICE_TEST_VIMEO:
        logger.info('Testing connection to Vimeo...')
        // Try to fetch the first page of videos as a connection test
        return require('./vimeo').fetchAll()
          .then(() => {
            logger.info('Successfully connected to Vimeo!')
            console.log('Successfully connected to Vimeo!')
            return prompt()
          })
          .catch(err => {
            logger.error('Failed to connect to Vimeo:', err.message)
            console.log('Failed to connect to Vimeo:', err.message)
            return prompt()
          })
      case constants.CHOICE_SHOW_VIMEO_COUNT:
        return require('./vimeo').fetchAll()
          .then(videos => {
            console.log(`You have ${videos.length} video(s) on your Vimeo account.`)
            return prompt()
          })
      case constants.CHOICE_RESET_DOWNLOADING: return databaseUtil.resetDownloadingVideos()
        .then(n => logger.info(`${n} video(s) reset`))
        .then(() => prompt())
      case constants.CHOICE_PRINT_LIST: return printUtil.all().then(() => prompt())
      case constants.CHOICE_REFRESH: return vimeoUtil.fetchAndInsert().then(() => prompt())
      default:
    }
  })

const start = () => vimeoUtil.fetchIfDatabaseIsEmpty().then(() => prompt())

module.exports = { start }
