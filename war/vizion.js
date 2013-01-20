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
Vizion.prototype.createVideoElement = function(width, height) {
        var video = document.createElement('video');
	video.width = width;
	video.height = height;
	video.autoplay = true;
	return video;
}
Vizion.prototype.addVideoElement = function(parent, width, height) {
        var parent = (parent instanceof Element) ? parent : document.getElementById(parent);
        parent.appendChild(this.createVideoElement(width, height));
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

function Shader(gl, type, text, name) {
  this.gl = gl;
  this.type = type;
  this.listeners = [];
  if (text != null) {
      this.setText(text, name);
  }
}

Shader.prototype.setText = function(text, name) {
  var id = this.gl.createShader(this.type);
  this.gl.shaderSource(id, text + ((name) ? "void main(){" + name + "();}" : ""));
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

function VertexShader(gl, text, name) {
    return new Shader(gl, gl.VERTEX_SHADER, text, name);
}

function FragmentShader(gl, text, name) {
    return new Shader(gl, gl.FRAGMENT_SHADER, text, name);
}

function Program(gl, vertexShader, fragmentShader) {
  this.gl = gl;
  this.vertexShader = (vertexShader instanceof Shader) ? vertexShader  : new VertexShader(gl, vertexShader);
  this.fragmentShader = (fragmentShader instanceof Shader) ? fragmentShader : new FragmentShader(gl, fragmentShader);
  this.id = gl.createProgram();
  this.attachedVertexShaderId = null;
  this.attachedFragmentShaderId = null;
  var self = this;
  this.shaderListener = function() {
    self.update();
  }
  this.vertexShader.addListener(this.shaderListener);
  this.fragmentShader.addListener(this.shaderListener);
  this.update();
}

Program.prototype.update = function() {
  this.uniforms = {};
  this.uniformDescriptors = {};
  this.attributes = {};
  this.attributeDescriptors = {};
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

    function defineUniformProperty(program, name) {
      Object.defineProperty(program.uniforms, name, {get: function() {return program.getUniform(name);},
                                                     set: function(value) {return program.setUniform(name, value);}}); 
    }

    function defineAttributeProperty(program, name) {
      Object.defineProperty(program.attributes, name, {get: function() {return program.getAttribute(name);},
                                                       set: function(value) {return program.setAttribute(name, value);}}); 
    }

    var numUniforms = gl.getProgramParameter(this.id, gl.ACTIVE_UNIFORMS);
    this.uniformDescriptors = [];
    for (var uniformIndex = 0; uniformIndex < numUniforms; uniformIndex++) {
      var uniform = gl.getActiveUniform(this.id, uniformIndex);
      var uniformName = uniform.name.replace(/\[[0-9]+\]$/, "");
      this.uniformDescriptors[uniformName] = {type: glIdToString(gl, uniform.type),
                                              size: uniform.size,
                                              location: gl.getUniformLocation(this.id, uniform.name)};
      defineUniformProperty(this, uniformName);
    }

    var numAttribs = gl.getProgramParameter(this.id, gl.ACTIVE_ATTRIBUTES);
    this.attributeDescriptors = [];
    for (var attribIndex = 0; attribIndex < numAttribs; attribIndex++) {
      var attrib = gl.getActiveAttrib(this.id, attribIndex);
      var attribName = attrib.name.replace(/\[[0-9]+\]$/, "");
      this.attributeDescriptors[attribName] = {type: glIdToString(gl, attrib.type),
                                               size: attrib.size,
                                               location: gl.getAttribLocation(this.id, attrib.name)};
      defineAttributeProperty(this, attribName);
    }
  }
}

Program.prototype.setVertexText = function(text, name) {
  return this.vertexShader.setText(text, name);
}

Program.prototype.setFragmentText = function(text, name) {
  return this.fragmentShader.setText(text, name);
}

Program.prototype.getUniform = function(uniform) {
  return (this.uniformDescriptors[uniform]) ? this.gl.getUniform(this.id, this.uniformDescriptors[uniform].location) : undefined;
}

Program.prototype.setUniform = function(uniform, value) {
  if (this.uniformDescriptors[uniform]) {
    value = (value instanceof Array) ? value : [value];
    var location = this.uniformDescriptors[uniform].location;
    switch (this.uniformDescriptors[uniform].type) {
      case "BOOL":
      case "INT":
      case "SAMPLER_2D":
      case "SAMPLER_CUBE":
        this.gl.uniform1iv(location, (value instanceof Int32Array) ? value : new Int32Array(value));
        break;
      case "FLOAT":
        this.gl.uniform1fv(location, (value instanceof Float32Array) ? value : new Float32Array(value));
        break;
      case "BOOL_VEC2":
      case "INT_VEC2":
        this.gl.uniform2iv(location, (value instanceof Int32Array) ? value : new Int32Array(value));
        break;
      case "FLOAT_VEC2":
        this.gl.uniform2fv(location, (value instanceof Float32Array) ? value : new Float32Array(value));
        break;
      case "BOOL_VEC3":
      case "INT_VEC3":
        this.gl.uniform3iv(location, (value instanceof Int32Array) ? value : new Int32Array(value));
        break;
      case "FLOAT_VEC3":
        this.gl.uniform3fv(location, (value instanceof Float32Array) ? value : new Float32Array(value));
        break;
      case "BOOL_VEC4":
      case "INT_VEC4":
        this.gl.uniform4iv(location, (value instanceof Int32Array) ? value : new Int32Array(value));
        break;
      case "FLOAT_VEC4":
        this.gl.uniform4fv(location, (value instanceof Float32Array) ? value : new Float32Array(value));
        break;
      case "FLOAT_MAT2":
        this.gl.uniformMatrix2fv(location, false, (value instanceof Float32Array) ? value : new Float32Array(value));
        break;
      case "FLOAT_MAT3":
        this.gl.uniformMatrix3fv(location, false, (value instanceof Float32Array) ? value : new Float32Array(value));
        break;
      case "FLOAT_MAT4":
        this.gl.uniformMatrix4fv(location, false, (value instanceof Float32Array) ? value : new Float32Array(value));
        break;
    }
  }
}

Program.prototype.getAttribute = function(attribute) {
  return (this.attributeDescriptors[attribute]) ? this.gl.getVertexAttrib(this.attributeDescriptors[attribute].location, gl.CURRENT_VERTEX_ATTRIB) : undefined;
}

Program.prototype.setAttribute = function(attribute, value) {
  if (this.attributeDescriptors[attribute]) {
    var location = this.attributeDescriptors[attribute].location;
    if (value) {
      value = (value instanceof Float32Array) ? value : new Float32Array(value);
      var buffer = this.attributeDescriptors[attribute].buffer;
      buffer = (buffer) ? buffer : gl.createBuffer();
      this.attributeDescriptors[attribute].buffer = buffer;
      this.gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(gl.ARRAY_BUFFER, value, gl.STATIC_DRAW);
      this.gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0); 
      this.gl.enableVertexAttribArray(location);
    } else {
      this.gl.disableVertexAttribArray(location);
    }
  }
}

Program.prototype.use = function() {
  this.gl.useProgram(this.id);
}

function Texture(gl, width, height) {
  if (gl) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.id = gl.createTexture();
    this.use();
    this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  }
}

Texture.prototype.use = function(channel) {
  channel = (channel) ? channel : gl.TEXTURE0;
  gl.activeTexture(channel);
  this.gl.bindTexture(gl.TEXTURE_2D, this.id);
}

function VideoTexture(gl, video) {
  Texture.call(this, gl, video.width, video.height);
  this.video = video;
}

VideoTexture.prototype = new Texture();

VideoTexture.prototype.update = function() {
  if (video.readyState == 4) {
    this.gl.bindTexture(gl.TEXTURE_2D, this.id);
    this.gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  }
}

function RenderTexture(gl, width, height, lodScaleX, lodScaleY) {
  Texture.call(this, gl, width, height);
  this.lodScaleX = (lodScaleX) ? lodScaleX : 0;
  this.lodScaleY = (lodScaleY) ? lodScaleY : 0;
  this.use();
  this.fbIds = [];
  var level = 0;
  while ((width >= 1) &&
         (height >= 1)) {
    this.gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    var fbId = gl.createFramebuffer();
    this.gl.bindFramebuffer(gl.FRAMEBUFFER, fbId);
    this.gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.id, level);
    this.fbIds.push(fbId);
    width *= lodScaleX;
    height *= lodScaleY;
    level++;
  }
  this.levels = level;
  this.gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

RenderTexture.prototype = new Texture();

RenderTexture.prototype.renderTo = function(level, x, y, width, height) {
  level = (level) ? level : 0;
  x = (x) ? x : 0;
  y = (y) ? y : 0;
  width = (width) ? width : (this.width * Math.pow(this.lodScaleX, level) - x);
  height = (height) ? height : (this.height * Math.pow(this.lodScaleY, level) - y);
  this.gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbIds[level]);
  this.gl.viewport(x, y, width, height);
}
