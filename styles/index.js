var fs = require('fs')
var compile = require('micro-css')
var forEach = require('async-each')
var env = process.env.NODE_ENV || 'development'
var cachedOutput = null

module.exports = function(cb) {

  if (cachedOutput) {
    return cb(null, cachedOutput)
  }

  fs.readdir(__dirname, function(err, files) {
    var result = ''
    var additional = ''

    forEach(files, function(file, next) {
      if (/\.mcss$/i.test(file)) {
        fs.readFile(__dirname + '/' + file, 'utf8', function(err, data){
          if (err) return next(err)
          result += data + '\n'
          next()
        })
      } else if (/\.css$/i.test(file)) {
        fs.readFile(__dirname + '/' + file, 'utf8', function(err, data){
          if (err) return next(err)
          additional += data + '\n'
          next()
        })
      } else {
        next()
      }
    }, function(err) {
      if (err) return cb(err)
      var compiled = compile(result) + additional

      if (env === 'production') {
        // cache the output for production
        cachedOutput = compiled
      }

      cb(null, compiled)
    })
  })
}