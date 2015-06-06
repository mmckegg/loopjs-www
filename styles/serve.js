var getStyles = require('./')

module.exports = function(req, res) {
  getStyles(function(err, data) {
    if (err) throw err
    res.type('css')
    res.send(data)
  })
}