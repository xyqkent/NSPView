const fs = require('fs')
const {app, BrowserWindow} = require('electron')

const PATH_CONFIG = './config.json'
let config = null
let ERROR_FLAG = false
try {
  let configRaw = fs.readFileSync(PATH_CONFIG)
  config = JSON.parse(configRaw)
} catch (e) {
  console.log();  
  alert(`无法读取: ${PATH_CONFIG}，请确认文件是否存在。`,"错误")
  ERROR_FLAG = true
}

const PATH_CONFIG_NUT = '../nut/conf/nut.default.conf'
let config_nut = null
let PATH_SCAN = ""
try {
  let configRaw = fs.readFileSync(PATH_CONFIG_NUT)
  config_nut = JSON.parse(configRaw)
  PATH_SCAN = config_nut.paths.scan
} catch (e) {
  console.log();
  alert(`无法读取: ${PATH_CONFIG_NUT}，请确认nut目录是否存在。`, "错误")
  ERROR_FLAG = true
}

const NUT_FOLDER = config.NUT_FOLDER || process.cwd()

module.exports = {
  ERROR_FLAG,
  NUT_FOLDER,
  IMAGES_FOLDER: config.IMAGES_FOLDER,
  PYTHON_CMD: config.PYTHON_CMD,
  NEW_CMD: config.NEW_CMD,
  CMD_SCRAPE_DELTA: config.CMD_SCRAPE_DELTA,
  CMD_SCAN: config.CMD_SCAN,
  CMD_FTP: config.CMD_FTP,
  CMD_USB: config.CMD_USB,
  CMD_UPDATE_NUTDB: config.CMD_UPDATE_NUTDB,
  CMD_INSTALL_GAME: config.CMD_INSTALL_GAME,
  PATH_ALL_GAMES: NUT_FOLDER + '/titledb/titles.json',
  PATH_HAVE_GAMES: NUT_FOLDER + '/titledb/files.json',
  PATH_SCAN,
  PATH_CONFIG_NUT
}
