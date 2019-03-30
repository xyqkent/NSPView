const fs = require('fs')
const exec = require('await-exec')
const {spawn,execFile} = require('child_process')
const {PYTHON_CMD, NUT_FOLDER, NEW_CMD} = require('./config')
const _ = require('lodash')

function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

function writeFile(path, data, onlyIfMissing = false) {
  return new Promise((resolve, reject) => {
    if (onlyIfMissing && fs.existsSync(path)) {
      resolve()
    } else {
      fs.writeFile(path, data, 'utf8', err => {
        if (err) reject(err)
        else resolve()
      })
    }
  })
}

function writeFileIfMissing(path, data) {
  return writeFile(path, data, true)
}

async function execWithPython(cmd, flag_o=true, flag_n=false, inPath="") {
  if (flag_o) options = {cwd: NUT_FOLDER} 
    else options = ""
  if (!flag_n) return exec(`${PYTHON_CMD} ${cmd}`, options)
    else {
      return exec(`${NEW_CMD} "${PYTHON_CMD} ${cmd} ${inPath}&pause&exit"`, options)}
}

async function execFileWithBat(cmd) {
  return execFile(`${cmd}`)
}

function spawnWithPython(cmd, flag_o=true, flag_n=false) {  
  if (flag_o) options = {cwd: NUT_FOLDER} 
    else options = ""
  if (!flag_n) return spawn(`${PYTHON_CMD} ${cmd}`, [], _.extend({shell: true}, options))
    else return spawn(`${NEW_CMD} "${PYTHON_CMD} ${cmd}"`, [], _.extend({shell: true}, options))  
}

module.exports = {
  readFile,
  writeFile,
  writeFileIfMissing,
  execWithPython,
  execFileWithBat,
  spawnWithPython
}
