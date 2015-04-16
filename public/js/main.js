/*jslint browser: true*/
/*global $, jQuery, alert, console*/

function $id(id) {
    return document.getElementById(id);
}

var dropbox = $id('dropbox');
var files = $id('files');
dropbox.addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();
    dropbox.className = null;
    var li = document.createElement('li');
    var str = 'name: ' + e.dataTransfer.files[0].name + ' size: ' + e.dataTransfer.files[0].size;
    console.log(str);
    li.appendChild(document.createTextNode(str));
    files.appendChild(li);
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