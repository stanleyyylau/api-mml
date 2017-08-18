var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var cors = require('cors')
var request = require('request');
var requestIp = require('request-ip');
var crypto = require('crypto');
var helper = require('sendgrid').mail;

if (!!process.env.PORT) {

    var mailchimpAPI = process.env.mailchimpAPI;
    var mailchimpEndpoint = process.env.mailchimpEndpoint;
    var sendGridKey = process.env.sendGridApiKey;
    var ip138Token = process.env.ip138Token; 
    var apiKeyForMsg = process.env.apiKeyForMsg;
    var mobilesToNotify = `${process.env.mobilesToNotify1},${process.env.mobilesToNotify2},${process.env.mobilesToNotify3}`;
    var emailsToNotify = Array(process.env.emailsToNotify1, process.env.emailsToNotify2, process.env.emailsToNotify3);

} else {
    var config = require('./config.js')
    
    var mailchimpAPI = config.mailchimpAPI;
    var mailchimpEndpoint = config.mailchimpEndpoint;
    var sendGridKey = config.sendGridApiKey;
    var ip138Token = config.ip138Token;
    var apiKeyForMsg = config.apiKeyForMsg;
    var mobilesToNotify = config.mobilesToNotify;
    var emailsToNotify = config.emailsToNotify;
}


var Mailchimp = require('mailchimp-api-v3')
var mailchimp = new Mailchimp(mailchimpAPI);

var clientIp; // clientIp is accessible inside incoming http stream

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

function sendMsgForNewLead () {
    request.post(
        'https://sms.yunpian.com/v2/sms/batch_send.json',
        { form: {
          apikey: apiKeyForMsg,
          mobile: mobilesToNotify,
          text: '【慢慢来】您的网站收到一条新的留言'
        } },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body)
            }
        }
    )
}

function addNewContactToMailChimp (email, name, wechat) {
    mailchimp.post(mailchimpEndpoint, {
        'status' : 'subscribed',
        'members': [{
            'email_address': email,
            "status": "subscribed",
            'merge_fields': {
                'NAME': name,
                'WECHAT': wechat
            }
        }]
      })
      .then(function(results) {
        console.log(results)
      })
      .catch(function (err) {
        console.log(err)
      })    
}

app.post('/seotool', function(req, res) {
    var email = req.body.email;
    var name = req.body.name;
    var wechat = req.body.wechat;
    var msg = req.body.msg;
    var domains = req.body.domains  // An array of strings, less than three
    var referer = req.headers.referer
    var hostName = req.headers.host
    var subscribe = req.body.subscribe
    // API usage limitation based on domain or host starts from here
    if (referer != 'https://www.mmldigi.com/free-seo-audit.html') {
        return res.json({
            responseCode: 403,
            msg: 'You are not allow to access'
        })
    }

    // Send msg no matter what
    sendMsgForNewLead();

    // First we will add user to mailchip subscriber list
    if(subscribe == 'yes') {
        addNewContactToMailChimp(email, name, wechat);
    }

    // Than we send that email out
    var helper = require('sendgrid').mail;
    var fromEmail = new helper.Email('api@mmldigi.com', 'MML SEO Audit');
    var toEmail = new helper.Personalization();
    // Config recipents here
    toEmail.addTo(new helper.Email(emailsToNotify[0]))
    toEmail.addTo(new helper.Email(emailsToNotify[1]))
    toEmail.addTo(new helper.Email(emailsToNotify[2]))
    var subject = 'Cheers!!! One New Lead For SEO Audit Marketing Campaign';
    var domainsHtml = '';
    domains.forEach(function(value, index) {
        domainsHtml += `<div>${value}</div>`
    }); // To to, output html here
    var content = new helper.Content('text/html', `<h2>客户信息如下</h2><div>名字: ${name}</div><div>Email: ${email}</div><div>Wechat: ${wechat}</div><div>接受订阅: ${subscribe}</div><div>来源IP: ${clientIp}</div><div>来源页面: ${referer}</div><div>用户留言<br>${msg}</div><h2>Domain/Domains to Audit:</h2>${domainsHtml}`);

    var mail = new helper.Mail()
    mail.setFrom(fromEmail)
    mail.setSubject(subject)
    mail.addContent(content)
    mail.addPersonalization(toEmail)

    
    var sg = require('sendgrid')(sendGridKey);
    var request = sg.emptyRequest({
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
        res.json({
            responseCode: response.statusCode,
            referer: referer,
            hostName: hostName
        })
    });

})

app.get('/', function(req, res){
    res.send(`hello there ${clientIp}`);
})

app.listen(port, function () {
    console.log('MML API listening on port ' + port);
});