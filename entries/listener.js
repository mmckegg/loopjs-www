var extend = require('loop-drop-remote')
var audioContext = require('loop-drop-audio-context')

var remote = extend(audioContext, document.getElementById('remote'))
remote.output.connect(audioContext.destination)

remote.connect('loopjs.com:7777', window.localStorage.nickname)

remote.on('nickname', function(nickname){
  window.localStorage.nickname = nickname
})