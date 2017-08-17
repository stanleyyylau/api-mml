var https = require("https");
setInterval(function() {
    https.get("https://api-mml.herokuapp.com/");
}, 300000); // every 5 minutes (300000)