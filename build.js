var mkdirp = require('mkdirp')
var fs = require('fs')
var join = require('path').join
var watchify = require('watchify')
var colors = require('cli-color')

var outpath = join(__dirname, 'build')
var entriesPath = join(__dirname, 'entries')

var watchViews = require('rincewind-watch')

mkdirp.sync(outpath)

var bundles = {
  'listener': './entries/listener.js'
}

var pages = {
  'index': './views/index.html',
  'listen': './views/listen.html'
}

var pendingSteps = 0
var pendingBundleError = false

Object.keys(bundles).forEach(function(key){
  pendingStep()
  var w = watchify(bundles[key])
  var pendingBundleError = false
  w.on('update', bundle)
  bundle()
  function bundle(){
    w.bundle({debug: true}).on('error', handleError).pipe(fs.createWriteStream(join(outpath, key + '.js'))).on('finish', function(){
      popStep()
      handleSucess()
    })
  }
})

pendingStep()
watchViews(pages, function(views, changedFiles){
  changedFiles.forEach(function(f){
    if (/.js$/.exec(f) && require.cache[f]){
      ;delete require.cache[f]
    }
  })

  Object.keys(pages).forEach(function(key){
    if (views[key]){
      fs.writeFileSync(join(outpath, key + '.html'), views[key]())
    }
  })
  popStep()
})


/// BUILD HELPERS

function pendingStep(){
  pendingSteps += 1
}
function popStep(){
  pendingSteps -= 1
  if (!pendingSteps){
    if (~process.argv.indexOf('-w') || ~process.argv.indexOf('--watch')){
      console.log('Build complete. Watching for changes...')
    } else {
      process.exit()
    }
  }
}

function handleSucess(){
  if (pendingBundleError){
    pendingBundleError = false
    console.log('** ' + colors.green('Rebuild successful!') + ' **')
  }
}

function handleError(err){
  console.log('** ' + colors.red('REBUILD ERROR') + ' **')
  var message = (err&&err.message||err||'Error').replace(/([\/][^\/ ]+)+(([\/][^\/ ]+){2}( |$))/g, ".$2")
    .replace(/: Line ([0-9]+)/, ":$1")
  console.error(message)
  pendingBundleError = true
}