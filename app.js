var express = require('express');
var app = express();

app.use('/', express.static('public'));
app.use(function(req, res, next) {
    res.status(404).send('Sorry cant find that!');
});
server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});