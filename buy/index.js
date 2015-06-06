var PayPal = require('./paypal')
var parseBody = require('body-parser')
var express = require('express')
var fs = require('fs')
var path = require('path')
var sendWelcome = require('./notifier')

var app = module.exports = express()
var env = process.env.NODE_ENV || 'development'
var root = process.env.BUY_ROOT || 'http://localhost:8080/buy-loop-drop'

var fileName = 'Loop Drop 2.7.0.zip'

app.engine('html', require('ejs').renderFile)
app.set('views', path.join(__dirname, '..', 'views'))

var paypal = PayPal.init(
  process.env.PAYPAL_USER || 'matt-facilitator_api1.wetsand.co.nz', 
  process.env.PAYPAL_PASS || '1403840788', 
  process.env.PAYPAL_SIGN || 'AFcWxV21C7fd0v3bYYYRCpSSRl31A.UA.oWQg2MdEe38YLAcmOj-eLHY', 
  root + '/complete',
  root + '/cancel',
  env === 'development'
)

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

app.post('/refund/:transaction', function(req, res) {
  paypal.detail(req.params.transaction, function(err, detail) {
    if (getRefundStatus(detail) === 'Refund-Available') {
      paypal.refund(req.params.transaction, req.query.criticism, function(err, detail) {
        res.redirect(root + '/refund/' + req.params.transaction)
      })
    } else {
      res.redirect(root + '/refund/' + req.params.transaction)
    }
  })
})

app.get('/now', function(req, res) {
  paypal.pay(Date.now(), 49, "Loop Drop v2 Early Adopter Download", "USD", function(err, url) {
    if (err) throw err
    res.redirect(url)
  })
})

app.get('/complete', function(req, res) {
  paypal.complete(req.query.token, req.query.PayerID, function(err, detail) {
    if (err) throw err
    sendWelcome(detail)
    res.redirect(root + '/download/' + detail.TRANSACTIONID)
  })
})

app.get('/download/:transaction', function(req, res) {
  res.render('download.html', {
    fileName: fileName,
    downloadUrl: root + '/download-now/' + req.params.transaction
  })
})

app.get('/download-now/:transaction', function(req, res) {
  paypal.detail(req.params.transaction, function(err, detail) {
    if (err) throw err
    if (getRefundStatus(detail) !== 'Refunded') {
      res.setHeader('Content-disposition', 'attachment; filename="' + fileName + '"');
      res.sendFile(path.join(__dirname, '../files', fileName))
    } else {
      res.redirect(root + '/refund/' + req.params.transaction)
    }
  })
})

app.get('/cancel', function(req, res) {
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