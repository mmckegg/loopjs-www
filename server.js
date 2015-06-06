var http = require('http')
var express = require('express')
 
var app = express()
app.use(express.static(__dirname + '/public'))

app.use('/buy-loop-drop', require('./buy'))
app.get('/bundle.css', require('./styles/serve'))

http.createServer(app).listen(8080);
console.log('Listening on :8080');