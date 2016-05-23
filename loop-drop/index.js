var express = require('express')
var path = require('path')
var compareVersion = require('compare-version')
var cors = require('cors')
var cookieParser = require('cookie-parser')()
var track = require('../track.js')
var https = require('https')
var concat = require('concat-stream')
var app = module.exports = express()
var root = (process.env.ROOT || 'http://localhost:8080') + '/loop-drop'
var downloadRoot = 'https://github.com/mmckegg/loop-drop-app/releases/download'

var lastCheckedRelease = 0
var latestRelease = null

app.engine('html', require('ejs').renderFile)
app.set('views', path.join(__dirname, '..', 'views'))

app.get('/', function (req, res) {
  res.redirect('/')
})

app.get('/check-version/:version', cors(), function (req, res) {
  getLatestRelease(function (release) {
    var currentVersion = req.params.version
    var latest = release.tag_name.slice(1)

    track(req, 'Check Version', {
      version: currentVersion
    })

    if (compareVersion(currentVersion, latest) < 0) {
      res.send({
        updateAvailable: true,
        version: latest,
        url: root + '/update?currentVersion=' + currentVersion
      })
    } else {
      res.send({
        updateAvailable: false
      })
    }
  }, true)
})

app.get('/update', cookieParser, function (req, res) {
  res.redirect(root + '/download')
})

app.get('/download', function (req, res) {
  getLatestRelease(function (release) {
    var downloadUrl = downloadRoot + '/' + release.tag_name
    var currentPlatform = 'linux64'||getPlatform(req)

    track(req, 'Download Page', {
      userPlatform: currentPlatform
    })

    res.render('download.html', {

      platforms: {
        mac: {
          downloadUrl: downloadUrl + '/Loop.Drop.' + release.tag_name + '.dmg',
          name: 'Mac OS X'
        },
        win32: {
          downloadUrl: downloadUrl + '/Loop.Drop.' + release.tag_name + '.msi',
          name: 'Windows 32-bit'
        },
        win64: {
          downloadUrl: downloadUrl + '/Loop.Drop.' + release.tag_name + '.x64.msi',
          name: 'Windows'
        },
        linux32: {
          downloadUrl: downloadUrl + '/Loop.Drop.' + release.tag_name + '-linux-ia32.zip',
          name: 'Linux ia32'
        },
        linux64: {
          downloadUrl: downloadUrl + '/Loop.Drop.' + release.tag_name + '-linux-x64.zip',
          name: 'Linux'
        }
      },

      changeLogUrl: release.html_url,
      latestVersion: release.tag_name.slice(1),
      currentPlatform: currentPlatform || 'mac'
    })
  })
})

function getLatestRelease (cb, useCache) {
  if (lastCheckedRelease > Date.now() - 1 * 60 * 1000) { // 1 minute
    cb(latestRelease)
  } else {
    if (useCache && latestRelease && lastCheckedRelease > Date.now() - 12 * 60 * 1000) { // 12 hours
      cb(latestRelease)
      cb = null
      // but then update anyway!
    }
    https.get({
      host: 'api.github.com',
      path: '/repos/mmckegg/loop-drop-app/releases/latest',
      headers: {
        'user-agent': 'loopjs.com'
      }
    }, function (res) {
      res.pipe(concat(function (data) {
        latestRelease = JSON.parse(data) || latestRelease
        lastCheckedRelease = Date.now()
        cb && cb(latestRelease)
      }))
    })
  }
}

function getPlatform (req) {
  var agent = req.headers['user-agent']
  if (agent.match(/Macintosh/)) {
    return 'mac'
  } else if (agent.match(/win64/i)) {
    return 'win64'
  } else if (agent.match(/Windows/i)) {
    return 'win32'
  } else if (agent.match(/Linux i686/i)) {
    return 'linux32'
  } else if (agent.match(/Linux x86_64/i)) {
    return 'linux64'
  }
}
