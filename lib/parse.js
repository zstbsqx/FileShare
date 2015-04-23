module.exports = function (str) {
  var res = {};
  var list = str.split(',');
  for (var i = 0; i < list.length; i++) {
    var args = list[i].split('=');
    res[args[0]] = args[1];
  }
  return res;
};