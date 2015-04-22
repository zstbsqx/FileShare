/*jslint node:true vars:true*/
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');
var dir = require('dir-util');

var FILE_PATH = 'files/';
var BUFFER_SIZE = 32768; //bytes
var MAX_STORE_SPACE = 200 * 1024 * 1024; //bytes

//TODO: change event names
app.use('/', express.static('public/'));
app.use('/files/', express.static('files/', {'dotfiles': 'allow'}));
app.use(function (req, res, next) {
  res.status(404).send('Sorry cant find that!');
});

io.on('connection', function (socket) {
  console.log('a user connected');
  socket.on('readdir', function () {
    console.log('readdir event');
    fs.readdir(FILE_PATH, function (err, files) {
      if (err) {
        console.error(err);
      } else {
        socket.emit('serverfiles', files);
      }
    });
  });
  socket.on('uploadreq', function (fileName, size) {
    console.log('uploadreq event');
    //if file does not exists
    var path = FILE_PATH + fileName;
    console.log('request upload to %s', path);
    fs.exists(path, function (exists) {
      if (exists) {
        console.log('file exists');
        socket.emit('uploadres', 'exist');
      } else {
        dir.getSize(FILE_PATH, function (err, dirsize) {
          if (err) {
            console.error(err);
          } else if (dirsize + size > MAX_STORE_SPACE) {
            console.log('Exceed max space');
            socket.emit('uploadres', 'nospace');
          } else {
            console.log('permit upload');
            socket.emit('uploadres', 'ok');
            //create empty file
            fs.open(path, 'w', function (err, fd) {
              if (err) {
                console.error(err);
              }
              socket.fd = fd;
            });
          }
        });
      }
    });
  });
  socket.on('chunk', function (file) {
    console.log('chunk event');
    var fileName = file.name, index = file.index, chunk = file.data, last = file.last;
    console.log('received %s\'s part %d, last = %s', fileName, index, last);
    //append to file
    var fd = socket.fd;
    var pos = index * BUFFER_SIZE;
    fs.write(fd, chunk, pos, 'Binary', function (err) {
      if (err) {
        console.error(err);
      }
      if (last) {
        console.log('send compelete event');
        socket.emit('compelete');
        fs.readdir(FILE_PATH, function (err, files) {
          if (err) {
            console.error(err);
          } else {
            io.emit('serverfiles', files);
          }
        });
        console.log('finish');
        fs.close(fd);
      } else {
        console.log('send chunk event');
        socket.emit('chunk', index + 1);
      }
    });
  });
  socket.on('abortupload', function (file) {
    console.log('abortupload event');
    var fileName = file.name, index = file.index;
    console.log('%s abort at chunk %d', fileName, index);
    var fd = socket.fd;
    fs.unlink(FILE_PATH + fileName, function (err) {
      if (err) {
        console.error(err);
      }
      console.log('deleted ' + fileName);
    });
    fs.close(fd);
  });
  socket.on('close', function () {
    console.log('close event');
    console.log('window closed');
  });
});

server.listen(3000, function () {
  console.log('App listening at http://localhost:3000');
});