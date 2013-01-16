(function() {
  var gl = WebGLRenderingContext.prototype;
  var getError = gl.getError;
  var idToString = {};
  var arrayToString = function(array) {
    var string = "";
    for (var elementIndex = 0; elementIndex < array.length; elementIndex++) {
      var element = array[elementIndex];
      if (typeof(element) == "string") {
        string += "\"" + ((element.length > 50) ? element.substring(0, 47) + "..." : element) + "\"";
      } else if (typeof(element) == "number") {
        string += idToString[element] || element;
      } else if (typeof(element) == "array") {
        string += "[" + ((element.length > 3) ? arrayToString(element.slice(3)) + ", ..." : arrayToString(element)) + "]";
      }
      if (element < array.length - 1) {
        string += ", ";
      }
    }
    return string;
  }
  var wrap = function(func, name) {
    return function() {
      var returnValue = func.apply(this, arguments);
      var error = getError.apply(this);
      if (error != gl.NO_ERROR) {
        console.error(name + "(" + arrayToString(arguments) + ") - " + idToString[error]);
      }
      return returnValue;
    }
  };
  for (var key in gl) {
    var value = gl[key];
    if (typeof(value) == "function") {
      gl[key] = wrap(value, key);
    } else {
      if (!idToString[value]) {
        idToString[value] = value + " or " + key;
      } else {
        idToString[value] += " or " + key; 
      }
    }
  }
})();