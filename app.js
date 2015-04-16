var http = require('http');
var fs = require('fs');

fs.readFile('./public/index.html', function (err, html) {
    if(err) {
        console.log(err);
    } else {
        http.createServer(function (req, res) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(html);
        }).listen(3000);
    }
});