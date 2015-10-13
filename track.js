var token = process.env.PIWIK_TOKEN
var root = (process.env.ROOT || 'http://localhost:8080')

var PiwikTracker = require('piwik-tracker')
var piwik = new PiwikTracker(1, 'http://stats.loopjs.com/piwik.php')

module.exports = function track (req, actionName, args) {
  var data = {
    url: root + req.originalUrl,
    action_name: actionName,
    ua: req.header('User-Agent'),
    lang: req.header('Accept-Language'),
    cvar: formatArgs(args),
    token_auth: token,
    cip: getRemoteAddr(req)
  }
  if (token && root) {
    piwik.track(data)
  } else {
    console.log(data)
  }
}

function getRemoteAddr (req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress
}

function formatArgs (args) {
  args = args || {}
  return JSON.stringify(Object.keys(args).reduce(function (result, key, index) {
    result[index + 1] = [key].concat(args[key])
    return result
  }, {}))
}
