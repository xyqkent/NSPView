// Modules to control application life and create native browser window
const {app, BrowserWindow} = require('electron')
const fs = require('fs')
const path = require('path')

const DEV_TOOLS = fs.existsSync('./_dev_tools')

if (DEV_TOOLS) {
  require('electron-reload')(__dirname)
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'assets/ghosts64.png'),
    title: `Xman NSP Viewer v${JSON.parse(fs.readFileSync('package.json')).version} `
  })
  mainWindow.setMenu(null)
  if (DEV_TOOLS) {
    mainWindow.webContents.openDevTools()
    mainWindow.maximize()
  }
  mainWindow.loadFile('view_src/index.html')
  mainWindow.on('closed', function() {
    mainWindow = null
  })
}

app.on('ready', createWindow)
app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function() {
  if (mainWindow === null) {
    createWindow()
  }
})