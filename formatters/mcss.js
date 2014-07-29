var mcss = require('micro-css')
module.exports = function(context){
  return mcss(context.content)
}