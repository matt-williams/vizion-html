varying highp vec2 uv;
uniform sampler2D t;
uniform highp vec2 duv;

highp float luma(highp vec2 pos) {
  return dot(texture2D(t, pos).rgb, vec3(0.2126, 0.7152, 0.0722));
}

highp vec4 pix(highp float val) {
  return vec4(val, val, val, 1);
}

highp float diff(highp vec2 pos, highp vec2 dpos) {
  return luma(pos + dpos) - luma(uv - dpos);
}

highp float grad(highp vec2 pos, highp vec2 dpos) {
  return pow(diff(pos, vec2(dpos.x, 0)), 2.0) + pow(diff(pos, vec2(0, dpos.y)), 2.0);
}

void main() {
  gl_FragColor = pix(grad(uv, duv));
}