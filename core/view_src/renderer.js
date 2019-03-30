// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const ElementUI = require('element-ui')
const Vtip = require('vtip')
const { Notification, Message, MessageBox } = require('element-ui')

const fs = require('fs')
const _ = require('lodash')
const Vue = require('vue/dist/vue.js')
const { shell } = require('electron')
const { dialog, getCurrentWindow } = require('electron').remote
Vue.use(ElementUI)
Vue.use(Vtip.directive)
const { readFile, writeFile, writeFileIfMissing, execWithPython, execFileWithBat, spawnWithPython } = require('./js/utils')

const {
    ERROR_FLAG,
    IMAGES_FOLDER,
    CMD_SCRAPE_DELTA,
    CMD_SCAN,
    CMD_FTP,
    CMD_USB,
    CMD_UPDATE_NUTDB,
    PATH_CONFIG_NUT,
    PATH_ALL_GAMES,
    PATH_HAVE_GAMES,
    PATH_SCAN,
    CMD_INSTALL_GAME
} = require('./js/config')

Vue.filter('formatBytes', function(a, b) {
    // https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
    if (a === 0) return '0 Bytes'
    else if (!a) return ''
    let c = 1024,
        d = b || 2,
        e = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        f = Math.floor(Math.log(a) / Math.log(c))
    return parseFloat((a / Math.pow(c, f)).toFixed(d)) + ' ' + e[f]
})

async function loadTitlesNutList() {
    let gamesByID = {}
    let haveBaseCount = 0
    try {
        let gamesData = await readFile(PATH_ALL_GAMES)
        let gamesJson = JSON.parse(gamesData)
        let havesData = await readFile(PATH_HAVE_GAMES)
        let havesJson = JSON.parse(havesData)

        _.each(gamesJson, function(data, id) {

            let { rightsId, name, region, numberOfPlayers, releaseDate, intro, description, size, publisher, languages, screenshots } = data

            id = _.toLower(id)
            let idUpper = _.toUpper(id)
            numberOfPlayers = _.parseInt(numberOfPlayers) || null
            name = _.trim(name)
            updVersion = null
            dlcNum = 0
            status = "Miss"
            basePath = ""
            updPath = ""
            dlcsPath = []
            releaseDate = releaseDate == null || releaseDate == "" ? "未知":releaseDate
            //语言列表翻译
            lang_str_array = { "ja": "日语,", "en": "英语,", "es": "西班牙语,", "fr": "法语,", "de": "德语,", "it": "意大利语,", "nl": "荷兰语,", "pt": "葡萄牙语,", "ru": "俄语,", "ko": "韩语,", "zh": "中文," }
            lang_str = ""
            if (typeof(languages) == "string" || languages == null) {} else {
                languages.forEach(function(v, i, a) {
                    lang_str += lang_str_array[v]
                });
                languages = lang_str.substr(0, lang_str.length - 1);
            }
            ss_num = (screenshots == null) ? 0 : Object.keys(screenshots).length
            if (_.isString(id) && id.length === 16 && id.substr(-3) == "000" && name != "") {
                havesJson.forEach(function(e, i) {
                    if (idUpper.substr(0, 12) == e.titleId.substr(0, 12)) {
                        l3 = e.titleId.substr(-3)
                        if (l3 == "000") {
                            status = "Current"
                            basePath = e.path
                            haveBaseCount++
                        } else if (l3 == "800") {
                            updVersion = "v." + e.version
                            updPath = e.path
                        } else {
                            dlcNum += 1
                            dlcsPath.push(e.path)
                        }
                    }
                });
                dlcNum = (dlcNum == 0) ? "" : dlcNum
                _.set(gamesByID, [id], { id, idUpper, rightsId, name, region, numberOfPlayers, releaseDate, intro, description, size, publisher, languages, updVersion, dlcNum, status, basePath, updPath, dlcsPath, ss_num })
            }
        })


    } catch (e) {
        console.error(e)
        if (fs.existsSync(PATH_ALL_GAMES)) {
            alert(`${e}\n\n尝试删除 ${PATH_ALL_GAMES} 和确认nut目录是否正确`, `无法读取: ${PATH_ALL_GAMES}`)
        }
        if (fs.existsSync(PATH_HAVE_GAMES)) {
            alert(`${e}\n\n尝试删除 ${PATH_HAVE_GAMES} 和确认nut目录是否正确`, `无法读取: ${PATH_HAVE_GAMES}`)
        } else {
            if (dialog.showMessageBox({ message: `找不到Nut的搜索配置文件${PATH_HAVE_GAMES}`, buttons: ['取消', '选择文件夹并扫描'] }) === 1) {
                pickScanDirDialog()
            }
        }
    }
    total = Object.keys(gamesByID).length
    return { gamesByID, total, haveBaseCount }
}

function newDate() {
    return new Date().format("yyyy-MM-dd hh:mm:ss")
}
Date.prototype.format = function(fmt) { //author: meizz   
    var o = {
        "M+": this.getMonth() + 1, //月份   
        "d+": this.getDate(), //日   
        "h+": this.getHours(), //小时   
        "m+": this.getMinutes(), //分   
        "s+": this.getSeconds(), //秒   
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度   
        "S": this.getMilliseconds() //毫秒   
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

async function reloadFiles() {
    data.loading = true
    let { gamesByID, total, haveBaseCount } = await loadTitlesNutList()
    data.allGames = gamesByID
    data.total = total
    data.loading = false
    console.log('reloadfiles')
    showLog(newDate(), "success", "加载游戏列表完毕。数据库共有：" + total + "个游戏，本地拥有：" + haveBaseCount + "个。")
}

async function pickScanDirDialog() {
    let folder = _.first(dialog.showOpenDialog({ properties: ['openDirectory'] }))
    if (folder) {
        try {
            let configSelf = JSON.parse(fs.readFileSync(PATH_CONFIG_NUT))
            configSelf.paths.scan = folder
            fs.writeFileSync(PATH_CONFIG_NUT, JSON.stringify(configSelf, null, 4))
            data.pathScan = folder
            //扫描前删除旧配置文件
            fs.unlink(PATH_HAVE_GAMES, function(error) {
                if (error) {
                    console.log(error);
                }
            })
            scanDirNut()
        } catch (e) {
            console.error(e)
            alert('写入Nut配置文件失败${PATH_CONFIG_NUT}')
        }
    }
}

async function scanDirNut() {
    console.log('nut scan games')
    let scanFlag = true //仅用于当前读取日志时候的一次性标记
    data.scanFlag = true //扫描过程中不能再次扫描和更换目录
    showLog(newDate(), "info", "正在通过nut扫描游戏目录...扫描时间由游戏量而定。")
    setTimeout(function() { showLog(newDate(), "info", "加载nut数据库文件中...") }, 500)
    let out = await spawnWithPython(CMD_SCAN, true)
    out.stdout.on('data', function(chunk) {});
    out.stderr.on('data', function(chunk) {
        if (scanFlag && /Traceback/.test(chunk.toString())) {
            showLog(newDate(), "error", "检测到nut发生错误，请下载最新的nut：https://github.com/blawar/nut")
        }
        if (scanFlag && /Scanning/.test(chunk.toString())) {
            let sum = (/\| ([0-9].{0,5}\/[0-9]{0,5})/g).exec(chunk.toString())
            try {
                sum = sum.length != 0 ? sum[0].split("/")[1] : 0
            } catch (e) {
                sum = 0
                console.log(e);
            }
            showLog(newDate(), "info", "nut读取数据库文件完成，检索到游戏数量为：" + sum)
            setTimeout(function() { showLog(newDate(), "info", "游戏信息记录中请稍后...") }, 500)
            scanFlag = false
        }
    });
    out.on('exit', function() {
        showLog(newDate(), "success", "nut扫描完成。")
        reloadFiles()
        data.scanFlag = false
    })
}

async function startFtp() {
    data.ftpFlag = true
    showLog(newDate(), "info", "已启动ftp服务，关闭黑色框即可停止服务。")
    setTimeout(function() { showLog(newDate(), "warning", "SXInstaller和Tinfoil管理器不支持ftp里的文件夹。") }, 500)
    let out = await execWithPython(CMD_FTP, false, true, data.pathScan)
    showLog(newDate(), "info", "ftp服务已关闭。")
    data.ftpFlag = false
    console.log('done', out)
}

async function startNutUSB() {
    data.usbFlag = true
    showLog(newDate(), "info", "已启动nut usb服务，关闭黑色框即可停止服务。")
    let out = await execWithPython(CMD_USB, true, true)
    showLog(newDate(), "info", "nut usb服务已关闭。")
    data.usbFlag = false
    console.log('done', out)
}

async function updateNutDB() {
    data.updDBFlag = true
    showLog(newDate(), "info", "开始更新nut数据库（预计214M），因为是访问Github，下载速度会不太OK。")
    setTimeout(function() { showLog(newDate(), "info", "数据库文件将保存在/nut/titledb/中，建议上github下载：https://github.com/blawar/nut") }, 500)
    let out = await execWithPython(CMD_UPDATE_NUTDB, false, true)
    showLog(newDate(), "info", "nut数据库更新已完成或被关闭，请确认操作即可。")
    data.updDBFlag = false
    setTimeout(function() { scanDirNut() }, 500)
    console.log('done', out)
}

async function nutScrapeDeltas() {
    data.dlPicFlag = true
    console.log('scrape deltas')
    showLog(newDate(), "info", "从E-shop中下载缺失的游戏图片（预计9G大小）请稍后...")
    setTimeout(function() { showLog(newDate(), "warning", "将弹出黑色框进行下载，如无错误，自动关闭后即为下载完成，请保证/nut/titles/images所在硬盘有剩余空间。") }, 500)
    let out = await execWithPython(CMD_SCRAPE_DELTA, true, true)
    data.dlPicFlag = false
    console.log('done', out)
}

async function gameInstall(path) {
    data.insGameFlag = true
    console.log(data.game.id);
    showLog(newDate(), "info", "开始安装" + data.game.id + ":" + data.game.name)
    let out = await execWithPython(CMD_INSTALL_GAME, false, true, '"' + path + '"')
    showLog(newDate(), "info", "安装窗口关闭，请查看NS是否安装成功。")
    data.insGameFlag = false
}

function showGameInfo(game) {
    var c = ["name", "publisher", "releaseDate", "size", "idUpper", "languages", "intro", "description"]
    c.forEach(function(e, i) {
        if (game[e] == "" || game[e] == null || game[e] == undefined) {
            game[e] = "无"
        }
    })

    //标题翻译
    if (!(tran == "" || tran == null || tran == undefined)) {
        var cn_name = tran[game.idUpper]
        if (!(cn_name == "" || cn_name == null || cn_name == undefined)) {
            game.name = cn_name
        }
    }

    return game
}

function translate2zh(or_str, set) {
    // var appid = '***';
    // var key = '***';
    // var salt = (new Date).getTime();
    var query = or_str
    if (query != null || query) {
        query = query.replace(/\n{2,}/g, '\n');
    }
    // var str1 = appid + query + salt + key;
    // var sign = MD5.createMD5String(str1);      
    // url = encodeURI("http://api.fanyi.baidu.com/api/trans/vip/translate?q=" + query + "&from=auto&to=zh&appid=" + appid + "&salt=" + salt + "&sign=" + sign)
    url = "https://fanyi.baidu.com/transapi?from=auto&to=zh&query=" + encodeURI(query)
    timedGetText(url, 5000, function(data) {
        if (JSON.parse(data).msg != "fail") {
            var res = JSON.parse(data).data
            var res_str = ""
            for (var i in res) {
                res_str += unescape(res[i].dst) + "\n\n"
            }
            Vue.set(vm.game, set, res_str.substr(0, res_str.length - 2))
        }
    })
}

function timedGetText(url, time, callback) {
    var request = new XMLHttpRequest();
    var timeout = false;
    var timer = setTimeout(function() {
        timeout = true;
        request.abort();
    }, time);
    request.open("GET", url);
    request.onreadystatechange = function() {
        if (request.readyState !== 4) return;
        if (timeout) return;
        clearTimeout(timer);
        if (request.status === 200) {
            callback(request.responseText);
        }
    }
    request.send(null);
}

function showLog(title, type, description) {
    data.history.unshift({
        title: title,
        type: type,
        description: description
    })
    Notification({
        title: title,
        message: description,
        type: type,
        position: 'bottom-right',
        duration: 6000
    })
}

function cloneObjectFn(obj) { // 对象复制
    return JSON.parse(JSON.stringify(obj))
}

var tran = {}
readTranJson("./view_src/tran_title.json")

async function readTranJson(path) {
    try {
        let t = await readFile(path)
        tran = eval('(' + t + ')') //JSON.parse(t)
    } catch (e) {
        console.error(e)
    }
    // return tran
}

let data = {
    errorFlag: ERROR_FLAG,
    octicons: require("octicons"), //图标输出
    imagesFolder: IMAGES_FOLDER,
    allGames: null,
    gameInfoVisible: false,
    game: {},
    gameInstallVisible: false,
    url: {
        bannerUrl: "",
        icon: "",
        screenshots: []
    },
    installGame: {
        basePath: [],
        updPath: [],
        dlcsPath: []
    },
    checkAllDlcs: false,
    isIndeterminate: false, //全选dlcs时候的不确定值
    sortByKey: 'status',
    sortByDir: 'asc',
    nowSortName:'status',
    nowSort: {prop: '', order: ''},
    tab: 'history',
    search: "",
    loading: true,
    showGamesAsTable: true,
    pathScan: PATH_SCAN,
    total: 0, //默认数据总数
    pagesize: 10, //每页的数据条数
    currentPage: 1, //默认开始页面
    tooltip: {
        reload: "扫描游戏",
        changeView: "切换视图",
        ftp: "启动FTP服务",
        nutUsb: "启动nut USB服务",
        updNutDB: "更新nut数据库",
        downloadPic: "下载游戏图片",
        installGameBtn: "安装游戏"
    },
    scanFlag: false,
    dlPicFlag: false,
    updDBFlag: false,
    usbFlag: false,
    ftpFlag: false,
    insGameFlag: false,
    history: []
}

let vm = new Vue({
    el: '#app',
    data,
    created: function() {
        if (!ERROR_FLAG) {
            reloadFiles()
            this.tab = "games"
            this.activeName = "games"
        }
    },
    computed: {
        filteredGames: function() {
            let search = _.toLower(this.search)
            let results = data.allGames
            var re = _.filter(results, game => {
                return _.includes(_.toLower(game.name), search) || _.includes(_.toLower(game.id), search)
            })
            data.total = Object.keys(re).length
            return _.orderBy(re, [this.sortByKey], [this.sortByDir])
        },
        shownGames: function() {
            return (this.filteredGames || []).slice((this.currentPage - 1) * this.pagesize, this.currentPage * this.pagesize)
        },
        tabGames: function() {
            return this.tab === 'games'
        },
        tabQueue: function() {
            return this.tab === 'queue'
        },
        tabHistory: function() {
            return this.tab === 'history'
        },
        tabSettings: function() {
            return this.tab === 'settings'
        }
    },
    methods: {
        scanDirNut: function() {
            scanDirNut()
        },
        reloadFiles: function() {
            reloadFiles()
        },
        scrapeDelta: function() {
            nutScrapeDeltas()
        },
        startFtp: function() {
            startFtp()
        },
        startNutUSB: function() {
            startNutUSB()
        },
        updateNutDB: function() {
            updateNutDB()
        },
        pickScanDirDialog: function() {
            pickScanDirDialog()
        },
        showGameInfo: function(game) {
            //图片地址处理
            imagesFolder = this.imagesFolder + "/"
            imagesIdPath = imagesFolder + game.id
            this.url.bannerUrl = "background-image: url(" + imagesIdPath + "/banner.jpg)"
            this.url.icon = imagesIdPath + "/icon.jpg"
            this.url.screenshots = []
            for (var i = 0; i <= game.ss_num - 1; i++) {
                var id = "ss-" + i
                var ahref = "#ss-" + i
                var img = imagesIdPath + "/screenshot" + i + ".jpg"
                this.url.screenshots.push({ id: id, img: img, ahref: ahref })
            }
            this.game = showGameInfo(cloneObjectFn(game))
            //游戏介绍翻译
            translate2zh(game.intro, "intro")
            translate2zh(game.description, "description")
            this.gameInfoVisible = true
        },
        gameInfoClose: function(done) {
            this.url = {
                "url": {
                    bannerUrl: "",
                    icon: "",
                    screenshots: []
                }
            }
            done()
        },
        // tab页面控制
        setTab: function(tab) {
            this.tab = tab.name
        },
        tableRowClassName: function({ row, rowindex }) {
            if (row.status == "Current") return 'success-row';
        },
        // 分页控制
        handleCurrentChange: function(currentPage) {
            this.currentPage = currentPage
        },
        handleSizeChange: function(pagesize) {
            this.pagesize = pagesize
        },
        // 游戏数据排序
        sortChange: function({ prop, order }) {
            data.sortByKey = prop == null ? "status" : prop
            data.sortByDir = order == null ? "asc" : order == "ascending" ? "asc" : "desc"
            data.nowSort = {prop: data.sortByKey , order: order}
        },
        sortChangeGrid: function(prop) {
          let order = "ascending"
          if (this.nowSort.prop==prop && this.nowSort.order == order) 
            order = 'descending'
          console.log(this.nowSort)
          this.$refs.gamesTable.clearSort()
          this.$refs.gamesTable.sort(prop, order)
          data.nowSort = {prop: prop, order: order}
          this.sortChange({prop: prop, order: order})
        },
        // 安装游戏的对话框
        showGameInstallDialog: function(game) {
            this.game = cloneObjectFn(game)
            this.gameInstallVisible = true
        },
        // 安装游戏按钮
        gameInstall: function() {
            let installNum = 0
            let path = this.installGame
            let inPath = ""
            if (path.basePath != "") { installNum += 1;
                inPath += path.basePath + "###" }
            if (path.updPath != "") { installNum += 1;
                inPath += path.updPath + "###" }
            installNum += path.dlcsPath.length
            path.dlcsPath.forEach(function(e, i) {
                inPath += e + "###"
            });
            if (installNum > 0) {
                MessageBox.confirm('请确认NS已进入Tinfoil的USB Install NSP选项，并与电脑正常连接。<img style="width:100%" src="assets/tinfoil-usb.png"><a></img>', '确定后将弹出Tinfoil安装框', {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    dangerouslyUseHTMLString: true
                }).then(() => {
                    gameInstall(inPath)
                }).catch(() => {

                });
            } else {
                MessageBox.alert('未选中NSP！！', '提示', {
                    confirmButtonText: '返回',
                    closeOnClickModal: true,
                    callback: action => {}
                });
            }

        },
        //dlcs多选时的功能函数
        dlcsCheckAllChange(val) {
            this.installGame.dlcsPath = val ? this.game.dlcsPath : [];
            this.isIndeterminate = false;
        },
        dlcsCheckedChange(value) {
            let checkedCount = value.length
            this.checkAllDlcs = checkedCount === this.game.dlcsPath.length;
            this.isIndeterminate = checkedCount > 0 && checkedCount < this.game.dlcsPath.length;
        }
    }
})