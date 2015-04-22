/*jslint node:true vars:true*/
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');
var dir = require('dir-util');
var session = require('express-session');
//var parseCookie = require('connect').utils.parseCookie;

var FILE_PATH = 'files/';
var BUFFER_SIZE = 32768; //bytes
var MAX_STORE_SPACE = 200 * 1024 * 1024; //bytes

//TODO: change event names
app.use('/', express.static('public/'));
app.use('/files/', express.static('files/', {'dotfiles': 'allow'}));
var sessionOpt = {
  name: 'sessionid',
  resave: false,
  saveUninitialized: false,
  secret: 'YOUTHSARNDS',
}
app.use(session(sessionOpt)); //TODO: add session option
app.use(function (req, res, next) {
  console.log('**********');
  console.log(req.session);
  console.log('**********');
  res.status(404).send('Sorry cant find that!');
});

io.use(function(socket, next) {
  console.log(socket.request.session);
  next();
});

io.on('connection', function (socket) {
  console.log('a user connected');
  console.log(socket.request.session);
//  console.log(parseCookie(data.headers.cookie));
  socket.on('socketinfo', function (info) {
    if (info.type === 'msg') {
      socket.type = 'msg';
      socket.userName = info.UserName;
      console.log('%s login', info.userName);
    } else if (info.type === 'file') {
      socket.type = 'file';
      socket.fileName = info.fileName;
      console.log('%s upload %s')
    } else {
      //socket.type = info.type;
      console.log('unknown socket type');
    }
  });
  socket.on('disconnect', function () {
    if (socket.type === 'msg') {
      console.log('user %s disconnected', socket.userName);
    } else if (socket.type == 'file') {
      console.log('socket for %s disconnected', socket.fileName);
      if (socket.fd) {
        console.log('when transfering');
        fs.unlink(FILE_PATH + socket.fileName, function (err) {
          if (err) {
            console.error(err);
          }
          fs.close(socket.fd);  //It seems to be safe to unlink before close fd. 
        });
      } else {
        console.log('after transformation is finished');
      }
    }
  });
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
        socket.fd = undefined;
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
});

server.listen(3000, function () {
  console.log('App listening at http://localhost:3000');
});