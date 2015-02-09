var staticModule = require('static-module')
var path = require('path')
var through = require('through2')

module.exports = function(bundle) {
  var stringified = JSON.stringify(bundle);
  var mockModule = {
    conf: function() {
      return stringified;
    }
  };

  return function (file, opts) {
    if (/\.json$/.test(file)) return through();

    var sm = staticModule({
      'bundle-app': mockModule
    });

    return sm;
  };
}
