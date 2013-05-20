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

function Stage(gl, inputs, programName, width, height, hidden, filter) {
  if (!Stage.vertexShader) {
    Stage.vertexShader = new VertexShader(gl,
                                          "attribute vec2 xy;\n" +
                                          "varying highp vec2 uv;\n" +
                                          "\n" +
                                          "void main() {\n" +
                                          "  gl_Position = vec4(xy, 0, 1);\n" +
                                          "  uv = 0.5 * (xy + 1.0);\n" +
                                          "}\n");
  }
  if (!Stage.identityProgram) {
    Stage.identityProgram = new Program(gl,
                                        Stage.vertexShader,
                                        "varying highp vec2 uv;\n" +
                                        "uniform sampler2D t;\n" +
                                        "uniform highp vec2 duv;\n" +
                                        "\n" +
                                        "void main() {\n" +
                                        "  gl_FragColor = vec4(texture2D(t, uv).rgb, 1.0);\n" +
                                        "}\n");
  }
  inputs = (inputs) ? ((inputs instanceof Array) ? inputs : [inputs]) : [];   
  if (programName) {
    this.inputs = inputs;
    this.programName = programName;
    if (!Stage.programs[programName]) {
      Stage.programs[programName] = new Program(gl, Stage.vertexShader);
    }
    this.program = Stage.programs[programName];
    var maxWidth = 0;
    var maxHeight = 0;
    for (var inputIdx = 0; inputIdx < inputs.length; inputIdx++) {
      var input = this.inputs[inputIdx];
      input = (input instanceof Stage) ? input.output : input;
      maxWidth = (maxWidth > input.width) ? maxWidth : input.width;
      maxHeight = (maxHeight > input.height) ? maxHeight : input.height;
    }
    width = (width) ? ((width > 1) ? width : width * maxWidth) : maxWidth;
    height = (height) ? ((height > 1) ? height : height * maxHeight) : maxHeight;
    this.output = new RenderTexture(gl, width, height, filter);
  } else {
    this.output = inputs[0];
  }
  this.hidden = (hidden == true);
}

Stage.vertices = new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]);
Stage.programs = {};

Stage.prototype.setFragmentText = function(text) {
  if ((this.programName) &&
      (Stage.programs[this.programName].getFragmentText() != text)) {
    this.program.setFragmentText(text, this.programName);
  }
}

Stage.prototype.update = function() {
  if (this.program) {
    this.program.use();
    this.program.attributes.xy = Stage.vertices;
    this.program.uniforms.duv = [1.0 / this.output.width, 1.0 / this.output.height];
    tSize = (this.program.uniformDescriptors.t) ? this.program.uniformDescriptors.t.size : 0;
    t = [];
    for (var inputIdx = 0; (inputIdx < this.inputs.length) && (t.length < tSize); inputIdx++) {
      var input = this.inputs[inputIdx];
      input = (input instanceof Stage) ? input.output : input;
      if (input instanceof Texture) {
        input.use(gl["TEXTURE" + t.length]);
        t.push(t.length);
      }
    }
    while (t.length < tSize) {
      t.push(0);
    }
    this.program.uniforms.t = t;
    this.output.renderTo();
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } else if (this.output instanceof VideoTexture) {
    this.output.update();
  }
}

Stage.prototype.display = function(x, y, width, height) {
  width = (width) ? width : this.output.width;
  height = (height) ? height : this.output.height;
  Stage.identityProgram.use();
  Stage.identityProgram.attributes.xy = Stage.vertices;
  Stage.identityProgram.uniforms.t = 0;
  this.output.use();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(x, canvas.height - y - height, width, height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

Stage.prototype.isHidden = function() {
  return this.hidden;
}
