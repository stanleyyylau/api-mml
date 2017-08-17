var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var cors = require('cors')
var request = require('request');
var requestIp = require('request-ip');
var crypto = require('crypto');
var helper = require('sendgrid').mail;

if (!process.env.PORT) {
    var config = require('./config.js')
    
    var mailchimpAPI = config.mailchimpAPI;
    var mailchimpEndpoint = config.mailchimpEndpoint;
    var sendGridKey = config.sendGridApiKey;
    var ip138Token = config.ip138Token;
} else {
    var mailchimpAPI = process.env.mailchimpAPI;
    var mailchimpEndpoint = process.env.mailchimpEndpoint;
    var sendGridKey = process.env.sendGridApiKey;
    var ip138Token = process.env.ip138Token;
}


var Mailchimp = require('mailchimp-api-v3')
var mailchimp = new Mailchimp(mailchimpAPI);

var clientIp;

// inside middleware handler
const ipMiddleware = function(req, res, next) {
    clientIp = requestIp.getClientIp(req);
    request.post(
          'https://api.ip138.com/query/',
          { form: { 
            ip: clientIp,
            datatype: "json",
            sign: crypto.createHash('md5').update(`ip=${clientIp}&token=${ip138Token}`).digest('hex'),
            oid: "9245",
            mid: "72126"
           } },
          function (error, response, body) {
              if (!error && response.statusCode == 200) {
                  console.log(body)
                  clientIp = body;
                  clientIp = clientIp.replace('\t', ' From ');
                  clientIp = clientIp.replace(/[ \f\t\v]+$/g, '');
                  next();
              } else {
                next();
              }
          }
      );
    
};


require('./keep-alive.js');

var app = express();
app.use(cors());
app.use(ipMiddleware)

var port = process.env.PORT || 5000;

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function(req, res){
    res.send(`hello there ${clientIp}`);
})


app.get('/send', function(req, res) {
    let helper = require('sendgrid').mail;
    let fromEmail = new helper.Email('api@mmldigi.com');
    let toEmail = new helper.Email('stanleyyylau@gmail.com, stanley@mmldigi.com');
    let subject = 'Sending with SendGrid is Fun';
    let content = new helper.Content('text/plain', 'and easy to do anywhere, even with Node.js');
    let mail = new helper.Mail(fromEmail, subject, toEmail, content);
    
    let sg = require('sendgrid')(sendGridKey);
    let request = sg.emptyRequest({
      method: 'POST',
      path: '/v3/mail/send',
      body: mail.toJSON()
    });
    
    sg.API(request, function (error, response) {
        if (error) {
          console.log('Error response received');
        }
        console.log(response.statusCode);
        console.log(response.body);
        console.log(response.headers);
    });


})


app.get('/subscribe', function(req, res) {

    mailchimp.post(mailchimpEndpoint, {
        // 'email_address' : 'stanley@mmldigi.com',
        'status' : 'subscribed',
        'members': [{
            'email_address': 'stanlfrey@mmldigital.com',
            "status": "subscribed",
            'merge_fields': {
                'NAME': 'Sffftan',
                'WECHAT': 'Sfffftan'
            }
        }]
      })
      .then(function(results) {
        console.log(results)
      })
      .catch(function (err) {
        console.log(err)
      })


})

app.listen(port, function () {
    console.log('MML API listening on port ' + port);
});