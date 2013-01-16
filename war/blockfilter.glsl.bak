varying highp vec2 uv;
uniform sampler2D t;
uniform highp vec2 duv;

lowp float luma(lowp vec3 rgb) {
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

lowp float luma(highp vec2 pos) {
  return luma(texture2D(t, pos).rgb);
}

lowp vec4 texture2D2x2(sampler2D t, highp vec2 uv, highp vec2 duv) {
  return (texture2D(t, uv) +
          texture2D(t, uv + vec2(duv.x, 0)) +
          texture2D(t, uv + vec2(0, duv.y)) +
          texture2D(t, uv + duv)) / 4.0;
}

lowp vec4 texture2D4x4(sampler2D t, highp vec2 uv, highp vec2 duv) {
  return (texture2D2x2(t, uv, duv) +
          texture2D2x2(t, uv + vec2(2.0 * duv.x, 0), duv) +
          texture2D2x2(t, uv + vec2(0, 2.0 * duv.y), duv) +
          texture2D2x2(t, uv + 2.0 * duv, duv)) / 4.0;
}

lowp vec4 texture2D8x8(sampler2D t, highp vec2 uv, highp vec2 duv) {
  return (texture2D4x4(t, uv, duv) +
          texture2D4x4(t, uv + vec2(4.0 * duv.x, 0), duv) +
          texture2D4x4(t, uv + vec2(0, 4.0 * duv.y), duv) +
          texture2D4x4(t, uv + 4.0 * duv, duv)) / 4.0;
}

highp vec4 pix(highp float val) {
  return vec4(val, val, val, 1);
}

void main() {
  gl_FragColor = pix(luma(texture2D8x8(t, floor(uv / duv / 8.0) * duv * 8.0, duv).rgb));
}
