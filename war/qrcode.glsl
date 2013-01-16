varying highp vec2 uv;
uniform sampler2D t;
uniform highp vec2 duv;

highp float luma(highp vec2 pos) {
  lowp vec3 rgb = texture2D(t, pos).rgb;
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

highp vec4 pix(highp float val) {
  return vec4(val, val, val, 1);
}

highp float gaussian(highp vec2 pos, highp vec2 dpos) {
  return 0.006 * luma(pos - 3.0 * vec2(dpos.x, 0)) +
         0.061 * luma(pos - 2.0 * vec2(dpos.x, 0)) +
         0.242 * luma(pos - vec2(dpos.x, 0)) +
         0.383 * luma(pos) +
         0.242 * luma(pos + vec2(dpos.x, 0)) +
         0.061 * luma(pos + 2.0 * vec2(dpos.x, 0)) +
         0.006 * luma(pos + 3.0 * vec2(dpos.x, 0));
}

highp float average(highp vec2 pos, highp vec2 dpos) {
  return (luma(pos - 3.0 * vec2(dpos.x, 0)) +
         luma(pos - 2.0 * vec2(dpos.x, 0)) +
         luma(pos - vec2(dpos.x, 0)) +
         luma(pos) +
         luma(pos + vec2(dpos.x, 0)) +
         luma(pos + 2.0 * vec2(dpos.x, 0)) +
         luma(pos + 3.0 * vec2(dpos.x, 0))) / 7.0;
}

highp float halfluma() {
  return average(vec2(0.5, 0.5), vec2(1.0/7.0, 0));
}

highp float contrast(highp vec2 pos, highp float halfluma) {
  return step(halfluma, luma(pos));
}

void main() {
  highp float halfluma = halfluma();
  highp float scale = 6.0;
  highp vec2 duvx = vec2(duv.x * scale, 0);
  gl_FragColor = vec4(step(contrast(uv, halfluma) + contrast(uv + duvx, halfluma) + contrast(uv - duvx, halfluma) + 1.0 - contrast(uv + duvx * 2.0, halfluma) + 1.0 - contrast(uv - duvx * 2.0, halfluma) + contrast(uv + duvx * 3.0, halfluma) + contrast(uv - duvx * 3.0, halfluma), 0.5), luma(uv), luma(uv), 1);
}
