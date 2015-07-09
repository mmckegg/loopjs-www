var PayPal = require('./paypal')
var parseBody = require('body-parser').urlencoded({extended:true})
var express = require('express')
var fs = require('fs')
var path = require('path')
var compareVersion = require('compare-version')
var cors = require('cors')
var cookieParser = require('cookie-parser')()
var sendWelcome = require('./notifier')

var app = module.exports = express()
var env = process.env.NODE_ENV || 'development'
var root = (process.env.ROOT || 'http://localhost:8080') + '/loop-drop'

var latest = '2.9.6'
var price = 15.00

var platforms = {
  win64: 'Loop Drop v' + latest + ' x64.msi',
  win32: 'Loop Drop v' + latest + '.msi',
  mac: 'Loop Drop v' + latest + '.dmg'
}

app.engine('html', require('ejs').renderFile)
app.set('views', path.join(__dirname, '..', 'views'))

var paypal = PayPal.init(
  process.env.PAYPAL_USER || 'matt-facilitator_api1.wetsand.co.nz', 
  process.env.PAYPAL_PASS || '1403840788', 
  process.env.PAYPAL_SIGN || 'AFcWxV21C7fd0v3bYYYRCpSSRl31A.UA.oWQg2MdEe38YLAcmOj-eLHY', 
  root + '/complete-purchase',
  root + '/cancel-purchase',
  env === 'development'
)

paypal.setPayOptions({
  PAGESTYLE: "LoopDrop"
})

app.get('/', function(req, res) {
  res.redirect('/')
})

app.get('/refund/:transaction', function(req, res) {
  paypal.detail(req.params.transaction, function(err, detail) {
    if (err) throw err

    var status = getRefundStatus(detail)
    res.render('refund.html', {
      status: status,
      transactionId: detail.TRANSACTIONID,
      receiptId: detail.RECEIPTID,
      payerId: req.query.PayerID
    })
  })
})

app.get('/check-version/:version', cors(), function(req, res) {
  var currentVersion = req.params.version
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
})

app.get('/update', cookieParser, function(req, res) {
  var downloadCode = req.cookies['loop-drop-download-code']
  if (downloadCode) {
    paypal.detail(downloadCode, function(err, detail) {
      if (detail.PAYMENTSTATUS === 'Completed') {
        res.redirect(root + '/download/' + downloadCode)
      } else {
        render()
      }
    })
  } else {
    render()
  }

  function render() {
    res.render('update.html', {
      latestVersion: latest,
      status: null
    })
  }
})

app.post('/update', parseBody, function(req, res) {
  if (req.body.email) {
    getEmailStatus(req.body.email, function(err, detail) {

      if (detail && detail.STATUS === 'Completed') {
        sendWelcome(detail)
      }

      res.render('update.html', {
        latestVersion: latest,
        email: req.body.email,
        status: detail ? detail.STATUS : 'Unknown'
      })

    })

  } else {
    res.redirect(root + '/update')
  }

})

app.post('/refund/:transaction', parseBody, function(req, res) {
  paypal.detail(req.params.transaction, function(err, detail) {
    if (getRefundStatus(detail) === 'Refund-Available') {
      logEvent('REFUND', userDetail(detail), req.body)
      paypal.refund(req.params.transaction, req.body.criticism, function(err, result) {
        res.redirect(root + '/refund/' + req.params.transaction)
      })
    } else {
      res.redirect(root + '/refund/' + req.params.transaction)
    }
  })
})

app.get('/buy-now', function(req, res) {
  paypal.pay(Date.now(), "loop-drop", price, "Loop Drop v2 Early Adopter Download", "USD", function(err, url) {
    if (err) throw err
    res.redirect(url)
  })
})

app.get('/complete-purchase', function(req, res) {
  paypal.complete(req.query.token, req.query.PayerID, function(err, detail) {
    if (err) throw err
    sendWelcome(detail)
    logEvent('PURCHASE', userDetail(detail))
    res.redirect(root + '/download/' + detail.TRANSACTIONID)
  })
})

app.get('/download/:transaction', function(req, res) {
  var downloadUrl = root + '/download-now/' + req.params.transaction
  res.render('download.html', {

    platforms: {
      mac: {
        downloadUrl: downloadUrl + '/mac',
        fileName: platforms.mac
      },
      win32: {
        downloadUrl: downloadUrl + '/win32',
        fileName: platforms.win32
      },
      win64: {
        downloadUrl: downloadUrl + '/win64',
        fileName: platforms.win64
      }
    },

    currentPlatform: getPlatform(req) || 'mac'
  })
})

app.get('/download-now/:transaction/:platform', function(req, res) {
  paypal.detail(req.params.transaction, function(err, detail) {
    if (err) throw err
    if (getRefundStatus(detail) !== 'Refunded') {
      var fileName = platforms[req.params.platform] || platforms.mac
      res.setHeader('Content-disposition', 'attachment; filename="' + fileName + '"');
      res.sendFile(path.join(__dirname, '../files', fileName))
      res.cookie('loop-drop-download-code', req.params.transaction, {
        maxAge: 365 * 24 * 60 * 60
      })
      logEvent('DOWNLOAD', userDetail(detail))
    } else {
      res.redirect(root + '/refund/' + req.params.transaction)
    }
  })
})

app.get('/cancel-purchase', function(req, res) {
  res.redirect('/')
})

function getRefundStatus(detail) {
  if (detail.PAYMENTSTATUS !== 'Completed') {
    return detail.PAYMENTSTATUS
  } else {
    var purchaseDate = new Date(detail.ORDERTIME)
    var maxDate = purchaseDate.getTime() + (7 * 24 * 60 * 60 * 1000)
    return (Date.now() < maxDate) ? 'Refund-Available' : 'Refund-Expired'
  }
}

function userDetail(data) {
  return data.FIRSTNAME + ' ' + data.LASTNAME + ' <' + data.EMAIL + '>'
}

function logEvent(type, user, additional) {
  console.log.apply(console, arguments)
}

function getEmailStatus(email, cb) {
  paypal.search(email, function(err, transactions) {
    var payments = (transactions || []).filter(function(t) { 
      return (t.TYPE === 'Payment') 
    })
    cb(null, payments[0])
  })
}

function getPlatform(req) {
  var agent = req.headers['user-agent']
  console.log(agent)
  if (agent.match(/Macintosh/)) {
    return 'mac'
  } else if (agent.match(/win64/i)) {
    return 'win64'
  } else if (agent.match(/Windows/i)) {
    return 'win32'
  }
}