/*jslint browser: true*/
/*global $, jQuery, alert, console*/

function $id(id) {
    return document.getElementById(id);
}

function $class(class) {
    return document.getElementsByClassName(class);
}

function $all(query) {
    return document.querySelectorAll(query);
}

function $(query) {
    return document.querySelector(query);
}

var dropbox = $id('dropbox');
var files = $id('files');
dropbox.addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();
    dropbox.className = null;
    files.innerHTML = "";
    var len = e.dataTransfer.files.length;
    for (var i = 0; i < len; i++) {
        var li = document.createElement('li');
        var str = [e.dataTransfer.files[i].name, '(' + (e.dataTransfer.files[i].type?e.dataTransfer.files[i].type:'unknown type') + ')',  e.dataTransfer.files[i].size + ' bytes', 'lastModifiedDate: ' + e.dataTransfer.files[i].lastModifiedDate,].join('<br>');
        console.log(str);
        li.innerHTML = str;
        files.appendChild(li);
    }
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

function D(e) {
    e.preventDefault();
}