/*jslint browser:true vars:true white:true*/
/*global $, jQuery, alert, console, io, FileReader*/
'use strict';
//TODO: change event names

function $id(id) {
  return document.getElementById(id);
}

function $byclass(byclass) {
  return document.getElementsByClassName(byclass);
}

function $all(query) {
  return document.querySelectorAll(query);
}

function $(query) {
  return document.querySelector(query);
}

//NOTE: global vars
//CONST
var filePath = 'files/';
var bufferSize = 4096 * 8;

//DOM
var dropbox = $id('dropbox');
var nameinput = $id('username');
var uploadfilelist = $id('uploadfiles');
var serverfilelist = $id('serverfiles');
var loginlayer = $id('login');

//Object
var globalSocket = io();

//record
var userName = "Anonymous";

//NOTE: functions
function fade(elem, timeout) {  //min timeout = 0, default = 2000
  timeout = timeout===null ? 2000 : timeout;
  if (timeout < 0) {
    timeout = 0;
  }
  setTimeout(function () {
    elem.style.opacity = 0;
    setTimeout(function () {
      elem.parentNode.removeChild(elem);
    }, 1000);
  }, timeout);
}

//TODO: don't use alert
function errorHandler(evt) {
  switch (evt.target.error.code) {
    case evt.target.error.NOT_FOUND_ERR:
      alert('File Not Found!');
      break;
    case evt.target.error.NOT_READABLE_ERR:
      alert('File is not readable');
      break;
    case evt.target.error.ABORT_ERR:
      break;
    default:
      alert('An error occurred reading this file.');
  }
  evt.target.abort();
}

function fileSlice(file, start, end) {
  if (file.slice) {
    return file.slice(start, end);
  } else if (file.webkitSlice) {
    return file.webkitSlice(start, end);
  } else if (file.mozSlice) {
    return file.mozSlice(start, end);
  } else {
    return false;
  }
}

function transferChunk(reader, file, index) {
  reader.index = index;
  var start = index * bufferSize, end = (index + 1) * bufferSize;
  if (end >= file.size) {
    end = file.size;
    reader.running = false;
  }
  var blob = fileSlice(file, start, end);
  reader.readAsBinaryString(blob);
}

function finishBar(progressBar, percentageBar, text, success, timeout) { 
  text = text || '100%';
  success = (success === null) ? true : success;
  percentageBar.style.width = '100%';
  percentageBar.innerHTML = text;
  if (success === false) {
    percentageBar.className = 'errorpercentagebar';
  }
  fade(progressBar, timeout);
}

function startProgress(file, progressBar, percentageBar) {
  var chunkCnt = Math.ceil(file.size / bufferSize);
  var socket = io();
  socket.emit('socketinfo', {type: 'file', fileName: file.name, uploader: userName});
  var reader;
  if ((file.size === 4096 || file.size === 0) && file.type === "") {  //it is a folder
    socket.disconnect();
    finishBar(progressBar, percentageBar, 'Folder not supported, please upload files.', false);
  } else {
    console.log('startprogress ' + file.name + '(' + file.type + ',' + file.size + ')');
    socket.emit('uploadreq', file.name, file.size);
    socket.on('uploadres', function (status) {
      console.log('uploadres event');
      switch (status) {
        case 'ok':
          reader = new FileReader();
          reader.fileName = file.name;
          reader.index = 0;
          reader.running = true;
          reader.onerror = errorHandler;
          reader.onabort = function (ev) {
            console.log('abortupload event triggered');
            globalSocket.emit('abortupload', {name: ev.target.fileName, index: ev.target.index});
          };
          transferChunk(reader, file, 0);

          reader.onloadend = function (ev) {
            if (!ev.target.result) {
              alert('Empty file?');
              ev.target.abort();
            } else if (ev.target.readyState === FileReader.DONE) {
              console.log('name: ' + ev.target.fileName + ' index: ' + ev.target.index);
              if (ev.target.running === true) {
                console.log('load success, not last chunk');
                socket.emit('chunk', {name: ev.target.fileName, index: ev.target.index, data: ev.target.result, last: false});
              } else {
                console.log('load success, last chunk');
                socket.emit('chunk', {name: ev.target.fileName, index: ev.target.index, data: ev.target.result, last: true});
              }
            } else {  //readyState != ready
              console.log('readyState error');
            }
          };


          socket.on('chunk', function (index) { //index indicates what to transfer(start from 0), data before index is ok
            console.log('chunk event');
            var percentage = (index / chunkCnt * 100).toFixed(1);
            if (percentage < 100) {
              percentageBar.style.width = percentage + '%';
              percentageBar.innerHTML = percentage + '%';
            }
            transferChunk(reader, file, index);
          });
          socket.on('compelete', function () {
            console.log('compelete event');
            socket.disconnect();
            finishBar(progressBar, percentageBar);
          });
          break;
        case 'exist':
          finishBar(progressBar, percentageBar, '\'' + file.name + '\'exists!', false);
          socket.disconnect();
          break;
        case 'nospace':
          finishBar(progressBar, percentageBar, 'No enough space on server.', false);
          socket.disconnect();
          break;
        default:
          finishBar(progressBar, percentageBar, 'unknown status: ' + status, false);
          socket.disconnect();
          break;
      }
    });
  }
}

function hideNext(ev) {
  var next = ev.target.nextSibling;
  if (next.style.display === 'none') {
    ev.target.innerHTML = 'More details(click to hide)';
    next.style.display = 'block';
  } else {
    ev.target.innerHTML = 'More details(click to show)';
    next.style.display = 'none';
  }
}

function addUploadItems(files) {
  //clear uploadfilelist
  while (uploadfilelist.lastChild) {
    uploadfilelist.removeChild(uploadfilelist.lastChild);
  }
  var len = files.length;
  var i;
  for (i = 0; i < len; i = i + 1) {
    var li = document.createElement('li');

    var fileName = document.createElement('div');
    fileName.innerHTML = files[i].name;
    fileName.className = 'fileName';

    var progressBar = document.createElement('div');
    progressBar.className = 'progressbar';
    var percentageBar = document.createElement('div');

    percentageBar.className = 'percentagebar';
    percentageBar.innerHTML = '0%';
    percentageBar.style.width = '0%';
    progressBar.appendChild(percentageBar);

    var detailBtn = document.createElement('button');
    detailBtn.innerHTML = 'More details(click to show)';
    detailBtn.addEventListener('click', hideNext);

    var fileDetail = document.createElement('div');
    fileDetail.className = 'detail';
    fileDetail.style.display = 'none';
    var fileInfo = document.createElement('p');
    fileInfo.innerHTML = ['<strong>Type:</strong>', (files[i].type || 'unknown type'), '<br><strong>Size:</strong>', files[i].size, 'bytes'].join(' ');

    li.appendChild(fileName);
    li.appendChild(progressBar);
    li.appendChild(detailBtn);
    li.appendChild(fileDetail);
    fileDetail.appendChild(fileInfo);
    uploadfilelist.appendChild(li);

    startProgress(files[i], progressBar, percentageBar);
  }
}

//NOTE: socket event registry here
globalSocket.on('serverfiles', function (filelist) {
  console.log('serverfiles event');
  while(serverfilelist.lastChild) {
    serverfilelist.removeChild(serverfilelist.lastChild);
  }
  var i;
  for (i = 0; i < filelist.length; i = i + 1) {
    var item = document.createElement('li');
    item.innerHTML = '<a href=\"' + filePath + filelist[i] + '\">' + filelist[i] + '</a>';
    serverfilelist.appendChild(item);
  }
});

//NOTE: DOM event registry here
dropbox.addEventListener('drop', function (e) {
  e.stopPropagation();
  e.preventDefault();
  dropbox.className = null;
  addUploadItems(e.dataTransfer.files);
});

dropbox.addEventListener('dragenter', function (e) {
  e.stopPropagation();
  e.preventDefault();
  dropbox.className = 'hover';
});

dropbox.addEventListener('dragleave', function (e) {
  e.stopPropagation();
  e.preventDefault();
  dropbox.className = null;
});

dropbox.addEventListener('dragover', function (e) {
  e.preventDefault();
});

nameinput.addEventListener('keydown', function (ev) {
  if(ev.keyCode === 13) //enter
  {
    userName = ev.target.value;
    ev.target.disabled = true;
    console.log('userName is ' + userName);
    globalSocket.emit('socketinfo', {type: 'msg', userName: userName});
    fade(loginlayer, 0);
  }
});

//NOTE: commands here
globalSocket.emit('readdir');
//TODO: check session
nameinput.focus();