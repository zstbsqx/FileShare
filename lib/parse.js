module.exports = function (str) {
  if (!str) {
    return {};
  }
  var res = {};
  var list = str.split(';');
  for (var i = 0; i < list.length; i++) {
    var args = list[i].split('=');
    res[args[0].trim()] = args[1].trim();
  }
  return res;
};
