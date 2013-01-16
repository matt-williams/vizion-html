Vizion = function() {
	this.getUserMedia = Vizion.wrap(navigator, navigator.webkitGetUserMedia);
	this.createObjectURL = Vizion.wrap(webkitURL, webkitURL.createObjectURL);
};

Vizion.wrap = function(object, method) {
	if (method) {
		return function() {
			return method.apply(object, arguments);
		};
	} else {
		return method;
	}
};
Vizion.logError = function(error) {
	console.error(error);
};
Vizion.prototype.cameraSupported = function() {
	return this.getUserMedia ? true : false;
};
Vizion.prototype.addVideoElement = function(parent, width, height) {
        var parent = (parent instanceof Element) ? parent : document.getElementById(parent);
	var video = document.createElement('video');
	video.width = width;
	video.height = height;
	video.autoplay = true;
	parent.appendChild(video);
	return video;
}
Vizion.prototype.addCanvasElement = function(parent, width, height) {
        var parent = (parent instanceof Element) ? parent : document.getElementById(parent);
	var canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	parent.appendChild(canvas);
	return canvas;
}

Vizion.prototype.getVideoURL = function(success, failure) {
	if (this.cameraSupported()) {
		var vizion = this;
		this.getUserMedia({video: true}, function(stream) {
			return success(vizion.createObjectURL(stream));
		}, failure);
	} else {
		failure("getUserMedia not supported");
	}
}

// TODO FIX

function glIdToString(gl, id) {
  var string = null;
  for (key in gl) {
    if (gl[key] == id) {
      if (!string) {
        string = key;
      } else {
        string = string + " or " + key;
      }
    }
  }
  return string;
}


function ShaderCompileException(logs) {
  this.logs = logs;
}

function Shader(gl, type, text) {
  this.gl = gl;
  this.type = type;
  this.listeners = [];
  if (text != null) {
    this.setText(text);
  }
}

Shader.prototype.setText = function(text) {
  var id = this.gl.createShader(this.type);
  this.gl.shaderSource(id, text);
  this.gl.compileShader(id);

  if (!this.gl.getShaderParameter(id, gl.COMPILE_STATUS)) {
    var glLogs = this.gl.getShaderInfoLog(id).split(/\n/);
    glLogs = glLogs.slice(0, glLogs.length - 1);
    var logs = [];
    for (var logIndex = 0; logIndex < glLogs.length; logIndex++) {
      var glLog = glLogs[logIndex];
      var logComponents = glLog.split(/:/);
      logs.push({type: logComponents[0].trim(),
                 column: parseInt(logComponents[1].trim()),
                 row: parseInt(logComponents[2].trim()),
                 message: logComponents.slice(3).join("")});
    }
    this.gl.deleteShader(id);
    throw new ShaderCompileException(logs);
  }

  this.text = text;
  if (this.id != null) {
    this.gl.deleteShader(this.id);
  }
  this.id = id;
  this.notifyListeners();
}

Shader.prototype.addListener = function(func) {
  this.listeners.push(func);
}

Shader.prototype.removeListener = function(func) {
  var listeners = [];
  for (var listenerIndex = 0; listenerIndex < this.listeners.length; listenerIndex++) {
    if (this.listeners[listenerIndex] != func) {
      listeners.push(func);
    }
  }
  this.listeners = listeners;
}

Shader.prototype.notifyListeners = function() {
  for (var listenerIndex = 0; listenerIndex < this.listeners.length; listenerIndex++) {
    this.listeners[listenerIndex]();
  }
}

function VertexShader(gl, text) {
  return new Shader(gl, gl.VERTEX_SHADER, text);
}

function FragmentShader(gl, text) {
  return new Shader(gl, gl.FRAGMENT_SHADER, text);
}

function Program(gl, vertexShader, fragmentShader) {
  this.gl = gl;
  this.vertexShader = vertexShader;
  this.fragmentShader = fragmentShader;
  this.id = gl.createProgram();
  this.attachedVertexShaderId = null;
  this.attachedFragmentShaderId = null;
  var self = this;
  this.shaderListener = function() {
    self.update();
  }
  vertexShader.addListener(this.shaderListener);
  fragmentShader.addListener(this.shaderListener);
  this.update();
}

Program.prototype.update = function() {
  if ((this.vertexShader.id != null) &&
      (this.fragmentShader.id != null)) {
    if (this.attachedVertexShaderId != this.vertexShader.id) {
      if (this.attachedVertexShaderId != null) {
        this.gl.detachShader(this.id, this.attachedVertexShaderId);
      }
      this.gl.attachShader(this.id, this.vertexShader.id);
      this.attachedVertexShaderId = this.vertexShader.id;
    } 
    if (this.attachedFragmentShaderId != this.fragmentShader.id) {
      if (this.attachedFragmentShaderId != null) {
        this.gl.detachShader(this.id, this.attachedFragmentShaderId);
      }
      this.gl.attachShader(this.id, this.fragmentShader.id);
      this.attachedFragmentShaderId = this.fragmentShader.id;
    }
    this.gl.linkProgram(this.id);
    if (!this.gl.getProgramParameter(this.id, gl.LINK_STATUS)) {
      console.log(this.gl.getProgramInfoLog(this.id));
    }

    var numUniforms = gl.getProgramParameter(prog.id, gl.ACTIVE_UNIFORMS);
    this.uniforms = [];
    for (var uniformIndex = 0; uniformIndex < numUniforms; uniformIndex++) {
      var uniform = gl.getActiveUniform(this.id, uniformIndex);
      this.uniforms.push({name: uniform.name.replace(/\[[0-9]+\]$/, ""),
                          type: glIdToString(gl, uniform.type),
                          size: uniform.size,
                          location: gl.getUniformLocation(this.id, uniform.name)});
                     
// BOOL, INT, FLOAT, BYTE?, SHORT?
// _VEC2, _VEC3, _V£C4
// FLOAT_MAT2, FLOAT_MAT3, FLOAT_MAT4
// HIGH_FLOAT, HIGH_INT?, LOW_INT?, LOW_FLOAT?, MEDIUM_FLOAT?, MEDIUM_INT?
// UNSIGNED_BYTE, UNSIGNED_INT, UNSIGNED_SHORT, UNSIGNED_SHORT_4_4_4_4, UNSIGNED_SHORT_5_5_5_1, UNSIGNED_SHORT_5_6_%?

    }

    var numAttribs = gl.getProgramParameter(prog.id, gl.ACTIVE_ATTRIBUTES);
    this.attributes = [];
    for (var attribIndex = 0; attribIndex < numAttribs; attribIndex++) {
      var attrib = gl.getActiveAttrib(this.id, attribIndex);
      this.attributes.push({name: attrib.name.replace(/\[[0-9]+\]$/, ""),
                            type: glIdToString(gl, attrib.type),
                            size: attrib.size,
                            location: gl.getAttribLocation(this.id, attrib.name)});
    }
  }
}

Program.prototype.getUniformValue = function(uniform) {
console.log(this, uniform);
  return this.gl.getUniform(this.id, uniform.location)
}

Program.prototype.use = function() {
  this.gl.useProgram(this.id);
}


function Texture(gl, source) {
  this.gl = gl;
  this.id = gl.createTexture();
  this.setSource(source);
}

Texture.prototype.setSource = function(source) {
}

