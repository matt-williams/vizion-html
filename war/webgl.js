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
      this.uniformDescriptors[uniformName] = {type: Program.glIdToString(gl, uniform.type),
                                              size: uniform.size,
                                              location: gl.getUniformLocation(this.id, uniform.name)};
      defineUniformProperty(this, uniformName);
    }

    var numAttribs = gl.getProgramParameter(this.id, gl.ACTIVE_ATTRIBUTES);
    this.attributeDescriptors = [];
    for (var attribIndex = 0; attribIndex < numAttribs; attribIndex++) {
      var attrib = gl.getActiveAttrib(this.id, attribIndex);
      var attribName = attrib.name.replace(/\[[0-9]+\]$/, "");
      this.attributeDescriptors[attribName] = {type: Program.glIdToString(gl, attrib.type),
                                               size: attrib.size,
                                               location: gl.getAttribLocation(this.id, attrib.name)};
      defineAttributeProperty(this, attribName);
    }
  }
}

Program.glIdToString = function(gl, id) {
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
    value = ((value instanceof Array) || (value instanceof Int32Array) || (value instanceof Float32Array)) ? value : [value];
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
      switch (this.attributeDescriptors[attribute].type) {
        case "FLOAT_VEC2":
          this.gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0); 
          break;
        case "FLOAT_VEC3":
          this.gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0); 
          break;
        case "FLOAT_VEC4":
          this.gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0); 
          break;
      }
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

function RenderTexture(gl, width, height) {
  Texture.call(this, gl, width, height);
  this.use();
  this.gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  this.fbId = gl.createFramebuffer();
  this.gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbId);
  this.gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.id, 0);
  this.gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

RenderTexture.prototype = new Texture();

RenderTexture.prototype.renderTo = function(x, y, width, height) {
  x = (x) ? x : 0;
  y = (y) ? y : 0;
  width = (width) ? width : this.width - x;
  height = (height) ? height : this.height - y;
  this.gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbId);
  this.gl.viewport(x, y, width, height);
}

function Matrix(matrix) {
  this.matrix = (matrix) ?
                  ((matrix instanceof Matrix) ? matrix.matrix.slice(0) : new Float32Array(matrix)) :
                  new Float32Array(32);
}

Matrix.frustum = function(left, right, top, bottom, near, far) {
  return new Matrix([2 * near / (right - left), 0, 0, 0,
                     0, 2 * near / (top - bottom), 0, 0,
                     (right + left) / (right - left), (top + bottom) / (top - bottom), - (far + near) / (far - near), -1,
                     0, 0, - 2 * far * near / (far - near), 0]);
}

Matrix.scaler = function(x, y, z) {
  return Matrix.identity.scale(x, y, z);
}

Matrix.translation = function(x, y, z) {
  return Matrix.identity.translate(x, y, z);
}

Matrix.rotation = function(a, x, y, z) {
  var cosA = Math.cos(a);
  var sinA = Math.sin(a);
  return new Matrix([cosA + x * x * (1 - cosA), y * x * (1 - cosA) + z * sinA, z * x * (1 - cosA) - y * sinA, 0,
                     x * y * (1 - cosA) - z * sinA, cosA + y * y * (1 - cosA), z * y * (1 - cosA) - x * sinA, 0,
                     x * z * (1 - cosA) + y * sinA, y * z * (1 - cosA) + x * sinA, cosA + z * z * (1 - cosA), 0,
                     0, 0, 0, 1]);
}

Matrix.prototype.times = function(matrix) {
  var result = new Float32Array(16); 
  var a = this.matrix;
  var b = matrix.matrix;
  for (var ii = 0; ii < 4; ii++) {
    for (var jj = 0; jj < 4; jj++) {
      var val = 0;
      for (var kk = 0; kk < 4; kk++) {
        val += a[kk * 4 + jj] * b[ii * 4 + kk];
      }
      result[ii * 4 + jj] = val;
    }
  }
  return new Matrix(result);
}

Matrix.prototype.transpose = function() {
  var result = new Float32Array(16);
  for (var ii = 0; ii < 4; ii++) {
    for (var jj = 0; jj < 4; jj++) {
      result[ii * 4 + jj] =  this.matrix[jj * 4 + ii];
    }
  }
  return new Matrix(result);
}

Matrix.prototype.scale = function(x, y, z) {
  var result = new Float32Array(16);
  for (var ii = 0; ii < 4; ii++) {
    result[ii * 4] = this.matrix[ii * 4] * x;
    result[ii * 4 + 1] = this.matrix[ii * 4 + 1] * y;
    result[ii * 4 + 2] = this.matrix[ii * 4 + 2] * z;
    result[ii * 4 + 3] = this.matrix[ii * 4 + 3];
  }
  return new Matrix(result);
}

Matrix.prototype.translate = function(x, y, z) {
  var result = new Float32Array(this.matrix);
  result[3] -= x;
  result[7] -= y;
  result[11] -= z;
  return new Matrix(result);
}

Matrix.prototype.rotate = function(a, x, y, z) {
  return this.times(Matrix.rotation(a, x, y, z));
}

Matrix.identity = new Matrix([1, 0, 0, 0,
                              0, 1, 0, 0,
                              0, 0, 1, 0,
                              0, 0, 0, 1]);
