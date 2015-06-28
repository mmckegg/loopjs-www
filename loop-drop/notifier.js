var Mailer = require('nodemailer');
var env = process.env.NODE_ENV || 'development'
var root = (process.env.ROOT || 'http://localhost:8080') + '/loop-drop'

var user = {
  user: process.env.GMAIL_USER,
  pass: process.env.GMAIL_PASS
}

// create reusable transporter object using SMTP transport
var transporter = Mailer.createTransport({
    service: 'Gmail',
    auth: user
});

module.exports = function(detail) {

  var message = {
    from: 'Matt McKegg <matt@wetsand.co.nz>',
    to: {
      name: detail.FIRSTNAME + ' ' + detail.LASTNAME,
      address: env === 'development' ? 'matt@wetsand.co.nz' : detail.EMAIL
    },
    subject: '[Loop Drop] Thanks for purchasing!',
    text: 'Hey there,\n\n' +
          'Thanks for purchasing Loop Drop! If you have any questions please let me know on twitter @MattMcKegg or send an email to matt@wetsand.co.nz\n\n' +

          'Loop Drop is still experimental and very much in active development. New versions are being released all the time, and you\'ll likely see some major changes!\n\n' +

          'If you encounter bugs, please let let me know. I\'ll try to address them as soon as possible.\n\n' +
          
          'Also keep an eye out for an email invite to join the Loop Drop chatroom on Slack!\n\n' +

          'Over the next little while, I\'ll be uploading a bunch of tutorial videos to the YouTube channel. Hopefully these will be helpful.\n' +
          'https://www.youtube.com/channel/UC2wAgvZBPlRoqHRQ7vS0RZg\n\n' +

          'Download Link: ' + root + '/download/' + detail.TRANSACTIONID + '\n' +
          'You can use this link to redownload the app again in the future.\n\n' +

          'Feel free to share this download link with your friends if they want to try Loop Drop! Just don\'t post it publicly.' +

          '- Matt' + '\n\n' +

          'p.s. If you want a refund due to disappointment go here: \n' +
          root + '/refund/' + detail.TRANSACTIONID + '\n\n' + 

          'Refunds must be claimed within 7 days of purchase.'
  }

  if (user && user.user) {
    transporter.sendMail(message, function (err) {
      if (err) {
        console.log(err)
      }
    });
  } else {
    console.log(message)
  }
}
