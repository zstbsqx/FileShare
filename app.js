/*jslint node:true vars:true*/
//NOTE:
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var session = require('express-session');
var redisStore = require('connect-redis')(session);

var fs = require('fs');
var dir = require('dir-util');
var parse = require('./lib/parse');
var signature = require('cookie-signature');

var config = require('./config.json');
var FILE_PATH = config.filePath;
var BUFFER_SIZE = config.bufferSize; //bytes
var MAX_STORE_SPACE = config.maxStoreSpace; //bytes
var COOKIE_SECRET = 'YOUTHSARNDS';

//TODO: change event names
//server config
var sessionStore = new redisStore({ttl: 1200});
var userStore = {}; //TODO: also change this
var sessionMiddleWare = session({
  cookie: {
    maxAge: 1200 * 1000
  },
  store: sessionStore,
  name: 'sessionid',
  resave: true,
  saveUninitialized: true,
  secret: COOKIE_SECRET
});
app.use(sessionMiddleWare);

//route
app.use('/', express.static('public/'));
app.use('/files/', express.static('files/', {'dotfiles': 'allow'}));
app.use(function (req, res, next) {
  res.status(404).send('Sorry cant find that!');
  next();
});
app.use(function (req, res, next) {
  console.log('.........................');
  console.log(req.session);
  console.log('.........................');
});

function getSession(socket, cb) {
  var cookie = parse(socket.request.headers.cookie);
  var raw = unescape(cookie.sessionid);  //decode special chars e.g %3A -> ':'
  console.log('************************');
  console.log('sessionid: ' + raw);
  if(raw === undefined) {
    console.log('no session yet');
    cb(null);
  } else {
    var sid;
    if (raw.substr(0, 2) === 's:') {
      sid = signature.unsign(raw.slice(2), COOKIE_SECRET);

      if (sid === false) {
        console.log('cookie signature invalid');
        sid = undefined;
      }
    } else {
      console.log('cookie unsigned')
    }
    sessionStore.load(sid, function (err, sess) {  ///unsign
      if (err) {
        console.log(err);
        cb(null);
      } else {
        if (!sess) {
          console.log("session not found");
        } else {
          console.log("session rdy");
          console.log(sess);
        }
        cb(sess);
      }
    });
  }
  console.log('************************');
}

io.on('connection', function (socket) {
  console.log('\na user connected');
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
    } else {
      console.log('a user disconnected before login');
    }
  });
  //right after connect
  socket.on('socketinfo', function (info) {
    for (var key in info) {
      socket[key] = info[key];
    }
    if (info.type === 'msg') {
      socket.join('msg');
      getSession(socket, function (sess) {
        if(!sess || !sess.userName) {
          socket.emit('loginres', null);
        } else {
          socket.emit('loginres', sess.userName);
        }
      });
    } else if (info.type === 'file') {
      socket.type = 'file';
      socket.fileName = info.fileName;
      console.log('%s upload %s', socket.userName, socket.fileName);
    } else {
      //socket.type = info.type;
      console.log('unknown socket type');
    }
  });
  socket.on('loginreq', function (userName) {
    getSession(socket, function (sess) {
      sess.userName = userName;
      sess.touch().save();
    });
    console.log('%s login', userName);
    socket.emit('loginres', userName);
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

server.listen(3000, function (err) {
  if(err) {
    console.error(err);
  }
  console.log('App listening at http://localhost:3000');
});
