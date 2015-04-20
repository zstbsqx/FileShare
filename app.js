/*jslint node:true vars:true*/
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

var filePath = 'files/';
var bufferSize = 4096 * 8;

app.use('/', express.static('public/'));
app.use('/files/', express.static('files/', {'dotfiles': 'allow'}));
app.use(function(req, res, next) {
  res.status(404).send('Sorry cant find that!');
});

io.on('connection', function (socket) {
  console.log('a user connected');
  socket.on('getfile', function () {
    fs.readdir(filePath, function (err, files) {
      if (err) {
        console.error(err);
      } else {
        console.log(files);
        socket.emit(files);
      }
    });
  });
  socket.on('sendfile', function (fileName) {
    //if file does not exists
    var path = filePath + fileName;
    console.log('request upload to %s', path);
    fs.exists(path, function (exists) {
      if(exists) {
        console.log('file exists');
        socket.emit('start', false);
      } else {
        console.log('start');
        socket.emit('start', true);
        //create empty file
        fs.open(path, 'w', function (err, fd) {
          if(err) {
            console.error(err);
          }
          socket.fd = fd;
        });
      }
    });
  });
  socket.on('chunk', function (file) {
    var fileName = file.name, index = file.index, chunk = file.data, last = file.last;
    console.log('received %s\'s part %d', fileName, index);
    //append to file
    var fd = socket.fd;
    var pos = index * bufferSize;
    fs.write(fd, chunk, pos, 'Binary', function (err) {
      if(err) {
        console.error(err);
      }
      if(last) {
        socket.emit('compelete');
        console.log('finish');
        fs.close(fd);
      } else {
        socket.emit('chunk', index + 1);
      }
    });
  });
  socket.on('abort', function (file) {
    var fileName = file.name, index = file.index;
    console.log('%s abort at chunk %d', fileName, index);
    var fd = socket.fd;
    fs.unlink(filePath + fileName, function (err) {
      if (err) {
        console.error(err);
      }
      console.log('delete ' + fileName);
    });
    //delete file?
    fs.close(fd);
  });
  socket.on('close', function () {
    console.log('window closed');
  });
});

server.listen(3000, function () {
  console.log('App listening at http://localhost:3000');
});