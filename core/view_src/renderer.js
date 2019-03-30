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
    NUT_FOLDER,
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

var gamesJson = null

var tran = {}

async function readTranJson(path) {
    try {
        let t = await readFile(path)
        tran = eval('(' + t + ')') //JSON.parse(t)
    } catch (e) {
        console.log(e)
    }
    // return tran
}

async function loadTitlesNutList() {
    let gamesByID = {}
    let haveBaseCount = 0

    await readTranJson("tran_title.json") //读取标题翻译文件
    try {
        let gamesData = await readFile(PATH_ALL_GAMES)
        gamesJson = JSON.parse(gamesData)
        let havesData = await readFile(PATH_HAVE_GAMES)
        let havesJson = JSON.parse(havesData)

        _.each(gamesJson, function(data, id) {

            let { rightsId, name, region, numberOfPlayers, releaseDate, intro, description, size, publisher, languages, screenshots, isDemo } = data

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
            releaseDate = releaseDate == null || releaseDate == "" ? "未知" : releaseDate
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
                cn_name = name
                if (!(tran == "" || tran == null || tran == undefined)) {
                    var tmp = tran[idUpper]
                    if (!(tmp == "" || tmp == null || tmp == undefined)) {
                        cn_name = tmp
                    }
                }
                _.set(gamesByID, [id], { id, idUpper, rightsId, name, cn_name, region, numberOfPlayers, releaseDate, intro, description, size, publisher, languages, updVersion, dlcNum, status, basePath, updPath, dlcsPath, ss_num, isDemo })
            }
        })


    } catch (e) {
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

async function saveJsonFile(region) {
    var filePath = NUT_FOLDER
    var gamesJsonSave = cloneObjectFn(gamesJson)
    var saveName = ""
    switch (region) {
        case "US":
            filePath += '/titledb/US.en.json'
            saveName = "/titles.US.en.json"
            break;
        case "HK":
            filePath += '/titledb/HK.zh.json'
            saveName = "/titles.HK.zh.json"
            break;
        default:
            return false
            break;
    }
    let regionData = await readFile(filePath)
    let regionJson = JSON.parse(regionData)
    //把中文都Unicode化
    _.each(regionJson, function(data, id) {
        data.region = region
        gamesJsonSave[data.id] = data
    });
    await writeFileIfMissing(NUT_FOLDER + saveName, '')
    let folder = _.first(dialog.showOpenDialog({ properties: ['openDirectory'] }))
    if (!folder) {
        showLog(newDate(), "info", "取消保存" + saveName)
        return false
    }
    await writeFile(folder + saveName, toUnicode(JSON.stringify(gamesJsonSave, null, 4)))
    showLog(newDate(), "success", "保存" + saveName + "成功")

}

function toUnicodeFun(data) {
    if (data == '' || typeof data == 'undefined') return '请输入汉字';
    var str = '';
    for (var i = 0; i < data.length; i++) {
        str += "\\u" + data.charCodeAt(i).toString(16);
    }
    return str;
}

function toUnicode(s) {
    return s.replace(/([\u3040-\u31FF]|[\u4E00-\u9FA5]|[\uFE30-\uFFA0])/g, function(newStr) {
        return "\\u" + newStr.charCodeAt(0).toString(16);
    });
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
    data.filterValue = ["3"] //默认不选择demo
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
                if (error) {}
            })
            scanDirNut()
        } catch (e) {
            alert('写入Nut配置文件失败${PATH_CONFIG_NUT}')
        }
    }
}

async function scanDirNut() {
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

async function startFtp(path = data.pathScan) {
    data.ftpFlag = true
    setTimeout(function() { showLog(newDate(), "info", "已启动ftp服务，关闭黑色框即可停止服务。") }, 100)
    setTimeout(function() { showLog(newDate(), "warning", "SXInstaller和Tinfoil管理器不支持ftp里的子目录，除非将子目录作为FTP文件夹才可以。") }, 500)
    let out = await execWithPython(CMD_FTP, false, true, path)
    showLog(newDate(), "info", "ftp服务已关闭。")
    data.ftpFlag = false
}

async function startNutUSB() {
    data.usbFlag = true
    showLog(newDate(), "info", "已启动nut usb服务，关闭黑色框即可停止服务。")
    let out = await execWithPython(CMD_USB, true, true)
    showLog(newDate(), "info", "nut usb服务已关闭。")
    data.usbFlag = false
}

async function updateNutDB() {
    data.updDBFlag = true
    showLog(newDate(), "info", "开始更新nut数据库（预计214M），因为是访问Github，下载速度会不太OK。")
    setTimeout(function() { showLog(newDate(), "info", "数据库文件将保存在/nut/titledb/中，建议上github下载：https://github.com/blawar/nut") }, 500)
    let out = await execWithPython(CMD_UPDATE_NUTDB, false, true)
    showLog(newDate(), "info", "nut数据库更新已完成或被关闭，请确认操作即可。")
    data.updDBFlag = false
    setTimeout(function() { scanDirNut() }, 500)
}

async function nutScrapeDeltas() {
    data.dlPicFlag = true
    showLog(newDate(), "info", "从E-shop中下载缺失的游戏图片（预计9G大小）请稍后...")
    setTimeout(function() { showLog(newDate(), "warning", "将弹出黑色框进行下载，如无错误，自动关闭后即为下载完成，请保证/nut/titles/images所在硬盘有剩余空间。") }, 500)
    let out = await execWithPython(CMD_SCRAPE_DELTA, true, true)
    data.dlPicFlag = false
}

async function gameInstall(path) {
    data.insGameFlag = true
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

let data = {
    errorFlag: ERROR_FLAG,
    octicons: require("octicons"), //图标输出
    imagesFolder: IMAGES_FOLDER,
    allGames: null,
    startFtpFlag: false,
    saveJsonVisible: false,
    gameInfoVisible: false,
    gameNameFlag: true,
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
    nowSortName: 'status',
    nowSort: { prop: '', order: '' },
    tab: 'history',
    search: "",
    loading: true,
    showGamesAsTable: true,
    pathScan: PATH_SCAN,
    total: 0, //默认数据总数
    pagesize: 10, //每页的数据条数
    pagesizes: [10, 20, 30, 40, 50],
    currentPage: 1, //默认开始页面
    tooltip: {
        reload: "扫描游戏",
        changeView: "切换视图",
        ftp: "启动FTP服务",
        nutUsb: "启动nut USB服务",
        updNutDB: "更新nut数据库",
        downloadPic: "下载游戏图片",
        installGameBtn: "安装游戏",
        saveJson: "保存titles.XX.xx.json"
    },
    scanFlag: false,
    dlPicFlag: false,
    updDBFlag: false,
    usbFlag: false,
    ftpFlag: false,
    insGameFlag: false,
    history: [],
    filterOption: [
        { value: '1', label: '已拥有' },
        { value: '3', label: '非Demo' },
        { value: '2', label: 'Demo' },
    ],
    filterValue: [],
    filter: {},
    windowHeight: 800,
    windowWidth: 1280,
    timer: null,
}

let vm = new Vue({
    el: '#app',
    data,
    created() {
        if (!ERROR_FLAG) {
            reloadFiles()
            this.tab = "games"
            this.activeName = "games"
        }
        this.windowResize()
    },
    mounted() {
        window.addEventListener('resize', this.windowResize);
    },
    computed: {
        filteredGames() {
            let search = _.toLower(this.search)
            let results = this.allGames
            var re = _.filter(results, game => {
                return _.includes(_.toLower(game.name), search) || _.includes(_.toLower(game.id), search) || _.includes(_.toLower(game.cn_name), search)
            })
            re = _.filter(re, this.filter)
            this.total = Object.keys(re).length
            return _.orderBy(re, [this.sortByKey], [this.sortByDir])
        },
        shownGames() {
            return (this.filteredGames || []).slice((this.currentPage - 1) * this.pagesize, this.currentPage * this.pagesize)
        },
        tabGames() {
            return this.tab === 'games'
        },
        tabQueue() {
            return this.tab === 'queue'
        },
        tabHistory() {
            return this.tab === 'history'
        },
        tabSettings() {
            return this.tab === 'settings'
        }
    },
    watch: {
        showGamesAsTable(val) {
            if (val) {
                this.pagesize = parseInt((this.windowHeight - 229) / 52)
            } else {
                this.pagesize = parseInt((this.windowWidth - 152) / 270) * parseInt((this.windowHeight - 195) / 270)
            }
            var pagesizes_tmp = []
            for (var i = 0; i < 4; i++) {
                pagesizes_tmp.push((i + 1) * 10)
                if ((i + 1) * 10 < this.pagesize && this.pagesize < (i + 2) * 10) {
                    pagesizes_tmp.push(this.pagesize)
                }
            }
            this.pagesizes = pagesizes_tmp
        },
        windowHeight(val) {
            setTimeout(() => {
                if (this.showGamesAsTable) {
                    this.pagesize = parseInt((val - 229) / 52)
                } else {
                    this.pagesize = parseInt((this.windowWidth - 152) / 270) * parseInt((val - 195) / 270)
                }
                var pagesizes_tmp = []
                for (var i = 0; i < 4; i++) {
                    pagesizes_tmp.push((i + 1) * 10)
                    if ((i + 1) * 10 < this.pagesize && this.pagesize < (i + 2) * 10) {
                        pagesizes_tmp.push(this.pagesize)
                    }
                }
                this.pagesizes = pagesizes_tmp
            }, 300);
        },
        filterValue(val) {
            var filter_tmp = {}
            val.forEach(function(e, i) {
                switch (e) {
                    case "1":
                        filter_tmp["status"] = "Current"
                        break;
                    case "2":
                        filter_tmp["isDemo"] = true
                        break;
                    case "3":
                        filter_tmp["isDemo"] = false
                        break;
                }
            });
            this.filter = filter_tmp
        },
        total(val) {
            if (val <= this.currentPage * this.pagesize)
                this.currentPage = 1
        }
    },
    methods: {
        windowResize() {
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => { // 只执行最后一个定时器的 结果
                this.windowHeight = window.innerHeight
                this.windowWidth = window.innerWidth
            }, 300); // 推迟 300 ms 在执行resize 效果 
        },
        scanDirNut() {
            scanDirNut()
        },
        reloadFiles() {
            reloadFiles()
        },
        scrapeDelta() {
            nutScrapeDeltas()
        },
        startFtp() {
            startFtp()
        },
        startFtpCustom() {
            let folder = _.first(dialog.showOpenDialog({ properties: ['openDirectory'] }))
            if (!folder) {
                showLog(newDate(), "info", "没有选择文件夹，默认路径启动FTP")
                startFtp()
                return false
            }
            startFtp(folder)
        },
        startNutUSB() {
            startNutUSB()
        },
        updateNutDB() {
            updateNutDB()
        },
        pickScanDirDialog() {
            pickScanDirDialog()
        },
        showGameInfo(game) {
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
        gameInfoClose(done) {
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
        setTab(tab) {
            this.tab = tab.name
        },
        tableRowClassName({ row, rowindex }) {
            if (row.status == "Current") return 'success-row';
        },
        // 分页控制
        handleCurrentChange(currentPage) {
            this.currentPage = currentPage
        },
        handleSizeChange(pagesize) {
            this.pagesize = pagesize
        },
        // 游戏数据排序
        sortChange({ prop, order }) {
            data.sortByKey = prop == null ? "status" : prop
            data.sortByDir = order == null ? "asc" : order == "ascending" ? "asc" : "desc"
            data.nowSort = { prop: data.sortByKey, order: order }
        },
        sortChangeGrid(prop) {
            let order = "ascending"
            if (this.nowSort.prop == prop && this.nowSort.order == order)
                order = 'descending'
            this.$refs.gamesTable.clearSort()
            this.$refs.gamesTable.sort(prop, order)
            data.nowSort = { prop: prop, order: order }
            this.sortChange({ prop: prop, order: order })
        },
        // 安装游戏的对话框
        showGameInstallDialog(game) {
            this.game = cloneObjectFn(game)
            this.gameInstallVisible = true
        },
        // 安装游戏按钮
        gameInstall() {
            let installNum = 0
            let path = this.installGame
            let inPath = ""
            if (path.basePath != "") {
                installNum += 1;
                inPath += path.basePath + "###"
            }
            if (path.updPath != "") {
                installNum += 1;
                inPath += path.updPath + "###"
            }
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
        },
        saveJsonFile(region) {
            saveJsonFile(region)
        }
    },
    beforeDestroy() {
        window.removeEventListener("resize", this.windowResize); // 通过有名函数 解除事件订阅
    }
})