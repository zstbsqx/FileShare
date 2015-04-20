/*jslint browser:true vars:true*/
/*jshint strict:false*/
/*global $, jQuery, alert, console, io, FileReader*/
var globalSocket = io();

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

function errorHandler(evt) {
  switch (evt.target.error.code) {
  case evt.target.error.NOT_FOUND_ERR:
    alert('File Not Found!');
    break;
  case evt.target.error.NOT_READABLE_ERR:
    alert('File is not readable');
    break;
  case evt.target.error.ABORT_ERR:
    break; // noop
  default:
    alert('An error occurred reading this file.');
  }
  evt.target.abort();
}

/*function updateProgress(evt) {
  // evt is an ProgressEvent.
  if (evt.lengthComputable) {
    var percentLoaded = ((evt.loaded / evt.total) * 100).toFixed(1);
    // Increase the progress bar length.
    if (percentLoaded < 100) {
      progress.style.width = percentLoaded + '%';
      progress.textContent = percentLoaded + '%';
    }
  }
}*///I didn't use native method

var dropbox = $id('dropbox');
var filelist = $id('files');

var bufferSize = 4096 * 8;

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
  //console.log('start transfer ' + file.name + '\'s chunk ' +index);
  reader.index = index;
  var start = index * bufferSize, end = (index + 1) * bufferSize;
  if (end >= file.size) {
    end = file.size;
    reader.running = false;
  }
  //console.log('from ' + start + ' to ' + end);
  var blob = fileSlice(file, start, end);
  reader.readAsBinaryString(blob);
}

function startProgress(file, progressBar, percentageBar) {
  var chunkCnt = Math.ceil(file.size / bufferSize);
  var socket = io();
  var reader;
  console.log('startprogress ' + file.name + '(' + file.type + ',' + file.size + ')');
  if (file.size === 4096 && file.type === "") {
    percentageBar.style.width = '100%';
    percentageBar.style.backgroundColor = 'red';
    percentageBar.innerHTML = 'Folder not supported, please upload files.';
    setTimeout(function () {
      progressBar.style.opacity = 0;
      setTimeout(function () {
        progressBar.parentNode.removeChild(progressBar);
      }, 1000);
    }, 2000);
  } else {
    socket.emit('sendfile', file.name);
  }
  
  socket.on('start', function (go) {
    if (go) {
      reader = new FileReader();
      reader.fileName = file.name;
      reader.index = 0;
      reader.running = true;
      reader.onerror = errorHandler;
      reader.onabort = function (ev) {
        socket.emit('abort', {name: ev.target.fileName, index: ev.target.index});
      };
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
        } else {
          //emit('fail', {name: file.name, index: ev.target.index});
          //transferChunk(reader, file, ev.target.index); //maybe needn't check with server
          console.log('readyState error');
        }
      };
      transferChunk(reader, file, 0);
      
      socket.on('chunk', function (index) { //index indicates what to transfer(start from 0), data before index is ok
        var percentage = (index / chunkCnt * 100).toFixed(1);
        if (percentage < 100) {
          percentageBar.style.width = percentage + '%';
          percentageBar.innerHTML = percentage + '%';
        }
        transferChunk(reader, file, index);
      });
      socket.on('compelete', function () {
        socket.disconnect();
        //socket.close();
        percentageBar.style.width = '100%';
        percentageBar.innerHTML = '100%';
        setTimeout(function () {
          progressBar.style.opacity = 0;
          setTimeout(function () {
            progressBar.parentNode.removeChild(progressBar);
          }, 1000);
        }, 2000);
      });
    } else {
      socket.disconnect();
      //socket.close();
      percentageBar.style.width = '100%';
      percentageBar.innerHTML = file.name+' exists!';
      setTimeout(function () {
        progressBar.style.opacity = 0;
        setTimeout(function () {
          progressBar.parentNode.removeChild(progressBar);
        }, 1000);
      }, 2000);
    }
  });
}

function hideNext(ev) {
  var next = this.nextSibling;
  if (next.style.display === 'none') {
    this.innerHTML = 'More details(click to hide)';
    next.style.display = 'block';
  } else {
    this.innerHTML = 'More details(click to show)';
    next.style.display = 'none';
  }
}

function addItems(files) {
  //clear filelist
  while (filelist.lastChild) {
    filelist.removeChild(filelist.lastChild);
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
    filelist.appendChild(li);
    
    startProgress(files[i], progressBar, percentageBar);
  }
}

window.addEventListener('unload', function (e) {
  globalSocket.emit('close');
});

dropbox.addEventListener('drop', function (e) {
  e.stopPropagation();
  e.preventDefault();
  dropbox.className = null;
  addItems(e.dataTransfer.files);
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