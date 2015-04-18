/*jslint browser: true*/
/*global $, jQuery, alert, console*/

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

var reader;
var progress = document.querySelector('.percent');

function abortRead() {
    reader.abort();
}

function errorHandler(evt) {
    switch(evt.target.error.code) {
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
    };
}

function updateProgress(evt) {
    // evt is an ProgressEvent.
    if (evt.lengthComputable) {
        var percentLoaded = Math.round((evt.loaded / evt.total) * 100);
        // Increase the progress bar length.
        if (percentLoaded < 100) {
            progress.style.width = percentLoaded + '%';
            progress.textContent = percentLoaded + '%';
        }
    }
}

var dropbox = $id('dropbox');
var filelist = $id('files');

function startProgress(file, progressBar, percentageBar) {
    console.log('start progress');
    var reader = new FileReader();
    reader.onerror = errorHandler;
    reader.onabort = function (ev) {
        alert('File read aborted.');
    }
    reader.onprogress = function (ev) {
        if(ev.lengthComputable) {
            var percentage = (ev.loaded/ev.total)*100;
            if(percentage < 100) {
                percentageBar.style.width = percentage + '%';
                percentageBar.innerHTML = percentage + '%';
            }
            console.log('%f percentage uploaded', percentage);
        }
    }
    reader.onload = function (ev) {
        percentageBar.style.width = '100%';
        percentageBar.innerHTML = '100%';
        //transfer file
    }
    //if file is a text file
    reader.readAsText(file);
    //else readAsBinaryString
}

function addItems(files) {
    //clear filelist
    while(filelist.lastChild) {
        filelist.removeChild(filelist.lastChild);
    }
    var len = files.length;
    for (var i = 0; i < len; i++) {
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
        detailBtn.addEventListener('click', function(ev) {
            next = this.nextSibling;
            if(next.style.display === 'none') {
                detailBtn.innerHTML = 'More details(click to hide)';
                next.style.display = 'block';
            } else {
                detailBtn.innerHTML = 'More details(click to show)';
                next.style.display = 'none';
            }
        });
        var fileDetail = document.createElement('div');
        fileDetail.style.display = 'none';
        var fileType = document.createElement('div');
        fileType.innerHTML = 'Type: ' + (files[i].type?files[i].type:'unknown type');
        fileType.className = 'fileType';
        var fileSize = document.createElement('div');
        fileSize.innerHTML = 'Size: ' + files[i].size + ' bytes';
        fileSize.className = 'fileSize';
        li.appendChild(fileName);
        li.appendChild(progressBar);
        li.appendChild(detailBtn);
        li.appendChild(fileDetail);
        fileDetail.appendChild(fileType);
        fileDetail.appendChild(fileSize);
        filelist.appendChild(li);
        startProgress(files[i], progressBar, percentageBar);
    }
}



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