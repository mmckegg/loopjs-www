// FROM https://github.com/petersirka/node-paypal-express-checkout/blob/master/index.js

var urlParser = require('url');
var https = require('https');
var querystring = require('querystring');
var extend = require('xtend');
var merge = require('xtend/mutable');

function Paypal(username, password, signature, returnUrl, cancelUrl, debug) {

  this.username = username;
  this.password = password;
  this.solutiontype = 'Mark';
  this.signature = signature;
  this.debug = debug || false;
  this.returnUrl = returnUrl;
  this.cancelUrl = cancelUrl;

  this.url = 'https://' + (debug ? 'api-3t.sandbox.paypal.com' : 'api-3t.paypal.com') + '/nvp';
  this.redirect = 'https://' + (debug ? 'www.sandbox.paypal.com/cgi-bin/webscr' : 'www.paypal.com/cgi-bin/webscr');
};

Paypal.prototype.setPayOptions = function(options) {
  this.payOptions = options;
}

Paypal.prototype.params = function() {
  var self = this;
  return {
    USER: self.username,
    PWD: self.password,
    SIGNATURE: self.signature,
    SOLUTIONTYPE: self.solutiontype,
    VERSION: '52.0'
  };
};


Paypal.prototype.complete = function(token, payer, callback) {

  if (typeof(token.get) !== 'undefined' && typeof(payer) === 'function') {
    callback = payer;
    payer = token.get.PayerID;
    token = token.get.token;
  }

  var self = this;
  var params = self.params();

  params.TOKEN = token;
  params.METHOD = 'GetExpressCheckoutDetails';

  self.request(self.url, 'POST', params, function(err, data) {

    if (err) {
      callback(err, data);
      return;
    }

    if (typeof(data.CUSTOM) === 'undefined') {
      callback(data, null);
      return;
    }

    var custom = data.CUSTOM.split('|');

    var params = self.params();
    params.PAYMENTACTION = 'Sale';
    params.PAYERID = payer;
    params.TOKEN = token;
    params.AMT = custom[2];
    params.CURRENCYCODE = custom[3];
    params.METHOD = 'DoExpressCheckoutPayment';

    self.request(self.url, 'POST', params, function(err, doData) {

      if (err) {
        callback(err, doData);
        return;
      }

      callback(null, extend(data, doData), custom[0], custom[2]);
    })
  });

  return self;
};

Paypal.prototype.pay = function(invoiceNumber, code, amount, description, currency, callback) {

  var self = this;
  var params = self.params();

  params.PAYMENTACTION = 'Sale';
  params.AMT = prepareNumber(amount);
  params.RETURNURL = self.returnUrl;
  params.CANCELURL = self.cancelUrl;
  params.DESC = description;
  params.NOSHIPPING = 1;
  params.ALLOWNOTE = 1;
  params.CURRENCYCODE = currency;
  params.METHOD = 'SetExpressCheckout';
  params.INVNUM = invoiceNumber;
  params.CUSTOM = invoiceNumber + '|' + code + '|' + params.AMT + '|' + currency;


  if (self.payOptions) {
    merge(params, self.payOptions)
  }

  self.request(self.url, 'POST', params, function(err, data) {

    if (err) {
      callback(err, null);
      return;
    }

    if (data.ACK === 'Success') {
      callback(null, self.redirect + '?cmd=_express-checkout&useraction=commit&token=' + data.TOKEN);
      return;
    }

    callback(new Error('ACK ' + data.ACK + ': ' + data.L_LONGMESSAGE0), null);
  });

  return self;
};

Paypal.prototype.detail = function(transaction, callback) {

  var self = this;
  var params = self.params();

  params.METHOD = 'GetTransactionDetails';
  params.TRANSACTIONID = transaction

  self.request(self.url, 'POST', params, function(err, data) {
    if (err) {
      return callback(err, null);
    } else if (data.ACK === 'Success') {
      return callback(null, data);
    } else {
      callback(new Error('ACK ' + data.ACK + ': ' + data.L_LONGMESSAGE0), null);
    }
  });

  return self;
};

Paypal.prototype.detail = function(transaction, callback) {

  var self = this;
  var params = self.params();

  params.METHOD = 'GetTransactionDetails';
  params.TRANSACTIONID = transaction

  self.request(self.url, 'POST', params, function(err, data) {
    if (err) {
      return callback(err, null);
    } else if (data.ACK === 'Success') {
      return callback(null, data);
    } else {
      callback(new Error('ACK ' + data.ACK + ': ' + data.L_LONGMESSAGE0), null);
    }
  });

  return self;
};

Paypal.prototype.search = function(email, callback) {

  var self = this;
  var params = self.params();

  params.METHOD = 'TransactionSearch';
  params.EMAIL = email
  params.STARTDATE = '2015-01-01T00:00:00Z'

  self.request(self.url, 'POST', params, function(err, data) {
    if (err) {
      return callback(err, null);
    } else if (data.ACK === 'Success') {
      return callback(null, formatSearchResults(data));
    } else {
      callback(new Error('ACK ' + data.ACK + ': ' + data.L_LONGMESSAGE0), null);
    }
  });

  return self;
};

Paypal.prototype.refund = function(transaction, memo, callback) {

  var self = this;
  var params = self.params();

  params.METHOD = 'RefundTransaction';
  params.REFUNDTYPE = 'Full';
  params.TRANSACTIONID = transaction
  params.NOTE = memo

  self.request(self.url, 'POST', params, function(err, data) {
    if (err) {
      return callback(err, null);
    } else if (data.ACK === 'Success') {
      return callback(null, data);
    } else {
      callback(new Error('ACK ' + data.ACK + ': ' + data.L_LONGMESSAGE0), null);
    }
  });

  return self;
};

Paypal.prototype.request = function(url, method, data, callback) {

  var self = this;
  var params = querystring.stringify(data);

  if (method === 'GET')
    url += '?' + params;

  var uri = urlParser.parse(url);
  var headers = {};

  headers['Content-Type'] = method === 'POST' ? 'application/x-www-form-urlencoded' : 'text/plain';
  headers['Content-Length'] = params.length;

  var location = '';
  var options = { protocol: uri.protocol, auth: uri.auth, method: method || 'GET', hostname: uri.hostname, port: uri.port, path: uri.path, agent: false, headers: headers };

  var response = function (res) {
    var buffer = '';

    res.on('data', function(chunk) {
      buffer += chunk.toString('utf8');
    })

    req.setTimeout(exports.timeout, function() {
      callback(new Error('timeout'), null);
    });

    res.on('end', function() {

      var error = null;
      var data = '';

      if (res.statusCode > 200) {
        error = new Error(res.statusCode);
        data = buffer;
      } else
        data = querystring.parse(buffer);

      callback(error, data);
    });
  };

  var req = https.request(options, response);

  if (method === 'POST')
    req.end(params);
  else
    req.end();

  return self;
};

function prepareNumber(num, doubleZero) {
  var str = num.toString().replace(',', '.');

  var index = str.indexOf('.');
  if (index > -1) {
    var len = str.substring(index + 1).length;
    if (len === 1)
      str += '0';
    if (len > 2)
      str = str.substring(0, index + 3);
  } else {
    if (doubleZero || true)
      str += '.00';
  }
  return str;
}

exports.timeout = 10000;
exports.Paypal = Paypal;

exports.init = function(username, password, signature, returnUrl, cancelUrl, debug) {
  return new Paypal(username, password, signature, returnUrl, cancelUrl, debug);
};

exports.create = function(username, password, signature, returnUrl, cancelUrl, debug) {
  return exports.init(username, password, signature, returnUrl, cancelUrl, debug);
};


function formatSearchResults(data) {
  var matcher = /^L_([A-Z]+)([0-9]+)$/
  var results = []
  Object.keys(data).forEach(function(v) {
    var match = matcher.exec(v)
    if (match) {
      var item = results[match[2]] = (results[match[2]] || [])
      item[match[1]] = data[v]
    }
  })
  return results
}
