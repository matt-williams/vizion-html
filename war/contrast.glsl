varying highp vec2 uv;
uniform sampler2D t[6];
uniform highp vec2 duv;

lowp float luma(lowp vec3 rgb) {
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

lowp float luma(sampler2D t, highp vec2 pos) {
  return luma(texture2D(t, pos).rgb);
}

lowp float val(lowp vec3 rgb) {
  return rgb.r;
}

lowp float val(sampler2D t, highp vec2 pos) {
  return val(texture2D(t, pos).rgb);
}

lowp float index(highp vec2 uv, highp vec2 duv) {
  return dot(uv - duv / 2.0, vec2(1.0, 1.0 / duv.y) / duv.x);
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

lowp vec4 gaussian5x1(sampler2D t, highp vec2 uv, highp vec2 duv) {
  return ( 7.0 / 107.0 * texture2D(t, uv - 2.0 * duv) +
          26.0 / 107.0 * texture2D(t, uv - 1.0 * duv) +
          41.0 / 107.0 * texture2D(t, uv) +
          26.0 / 107.0 * texture2D(t, uv + 1.0 * duv) +
           7.0 / 107.0 * texture2D(t, uv + 2.0 * duv));
}

lowp float contrast(sampler2D t1, sampler2D t2, highp vec2 uv) {
  return smoothstep(luma(t2, uv) * 0.9, luma(t2, uv) * 1.1, luma(t1, uv));
}

lowp vec4 despeckle(sampler2D t, highp vec2 uv, highp vec2 duv) {
  lowp vec4 surround = texture2D(t, uv + vec2(-duv.x, -duv.y)) +
                       texture2D(t, uv + vec2(0, -duv.y)) +
                       texture2D(t, uv + vec2(duv.x, -duv.y)) +
                       texture2D(t, uv + vec2(-duv.x, 0)) +
                       texture2D(t, uv + vec2(duv.x, 0)) +
                       texture2D(t, uv + vec2(-duv.x, duv.y)) +
                       texture2D(t, uv + vec2(0, duv.y)) +
                       texture2D(t, uv + vec2(duv.x, duv.y));
  lowp vec4 center = texture2D(t, uv);
  return clamp(center, step(5.5, surround), step(2.5, surround));
}

lowp vec4 accumulateUp(sampler2D t, highp vec2 uv, highp vec2 duv) {
  lowp vec4 lo = texture2D(t, uv - duv / 4.0);
  lowp vec4 hi = texture2D(t, uv + duv / 4.0);
  return vec4((lo.rb + step(1.0, lo.rb) * hi.rb), (hi.ga + step(1.0, hi.ga) * lo.ga)).rbga * 0.5;
}

lowp vec4 accumulateDown(sampler2D loT, sampler2D ourT, highp vec2 uv, highp vec2 duvNorm, highp float duvLen) {
  lowp vec4 lo = texture2D(loT, uv);
  lowp vec4 our = texture2D(ourT, uv);
  lowp vec4 res;
  if (mod(dot(uv, duvNorm), 2.0 * duvLen) < duvLen) {
    lowp vec4 lo2 = texture2D(loT, uv - duvNorm * duvLen * 1.5) * step(0.0, dot(uv, duvNorm) - 1.5 * duvLen);
    res = vec4(lo.rb, duvLen * our.ga + step(1.0, our.ga) * lo2.ga).rbga;
  } else {
    lowp vec4 lo2 = texture2D(loT, uv + duvNorm * duvLen * 1.5) * step(dot(uv, duvNorm) + 1.5 * duvLen, 1.0);
    res = vec4(duvLen * our.rb + step(1.0, our.rb) * lo2.rb, lo.ga).rbga;
  }
  lowp vec2 mx = step(res.rg, res.ba);
  return res * vec4(1.0 - mx, mx);
}

lowp float detect(sampler2D t, highp vec2 uv, highp vec2 duvNorm, highp float duvLen) {
  lowp vec4 mid = texture2D(t, uv);
  lowp vec4 lo = texture2D(t, uv - duvNorm * (mid.a + duvLen));
  lowp vec4 hi = texture2D(t, uv + duvNorm * (mid.b + duvLen));
  lowp vec4 lo2 = texture2D(t, uv - duvNorm * (mid.a + lo.g + duvLen));
  lowp vec4 hi2 = texture2D(t, uv + duvNorm * (mid.b + hi.r + duvLen));
  return step(mid.r + mid.g, 0.0) *
         smoothstep(-0.02, 0.0, -abs(mid.b - mid.a)) *
         smoothstep(-0.02, 0.0, -abs(mid.a - 1.5 * lo.g)) *
         smoothstep(-0.02, 0.0, -abs(mid.b - 1.5 * hi.r)) *
         smoothstep(-0.02, 0.0, -abs(mid.a - 1.5 * lo2.a)) *
         smoothstep(-0.02, 0.0, -abs(mid.b - 1.5 * hi2.b));
}

lowp float brightest2x2(sampler2D t, highp vec2 uv, highp vec2 duv) {
  return max(max(val(t, uv),
                 val(t, uv + vec2(duv.x, 0))),
             max(val(t, uv + vec2(0, duv.y)),
                 val(t, uv + vec2(duv.x, duv.y))));
}
lowp float brightest4x4(sampler2D t, highp vec2 uv, highp vec2 duv) {
  return max(max(brightest2x2(t, uv, duv),
                 brightest2x2(t, uv + 2.0 * vec2(duv.x, 0), duv)),
             max(brightest2x2(t, uv + 2.0 * vec2(0, duv.y), duv),
                 brightest2x2(t, uv + 2.0 * vec2(duv.x, duv.y), duv)));
}
lowp float brightest8x8(sampler2D t, highp vec2 uv, highp vec2 duv) {
  return max(max(brightest4x4(t, uv, duv),
                 brightest4x4(t, uv + 4.0 * vec2(duv.x, 0), duv)),
             max(brightest4x4(t, uv + 4.0 * vec2(0, duv.y), duv),
                 brightest4x4(t, uv + 4.0 * vec2(duv.x, duv.y), duv)));
}

highp float vec2float(lowp vec3 v) {
  return dot(floor(v), vec3(65536.0, 256.0, 1.0));
}
lowp vec3 float2vec(highp float f) {
  return floor(mod(vec3(f / 65536.0, f / 256.0, f), 256.0));
}
highp float valpos(sampler2D t, highp vec2 uv, highp vec2 duv, highp vec2 pos) {
  return vec2float(vec3(val(t, uv + pos * duv) * 255.0, pos));
}

highp float find2x2(sampler2D t, highp vec2 uv, highp vec2 duv, highp vec2 pos) {
  return max(max(valpos(t, uv, duv, pos + vec2(0, 0)),
                 valpos(t, uv, duv, pos + vec2(1.0, 0))),
             max(valpos(t, uv, duv, pos + vec2(0, 1.0)),
                 valpos(t, uv, duv, pos + vec2(1.0, 1.0))));
}
highp float find4x4(sampler2D t, highp vec2 uv, highp vec2 duv, highp vec2 pos) {
  return max(max(find2x2(t, uv, duv, pos + vec2(0, 0)),
                 find2x2(t, uv, duv, pos + vec2(2.0, 0))),
             max(find2x2(t, uv, duv, pos + vec2(0, 2.0)),
                 find2x2(t, uv, duv, pos + vec2(2.0, 2.0))));
}
highp float find8x8(sampler2D t, highp vec2 uv, highp vec2 duv, highp vec2 pos) {
  return max(max(find4x4(t, uv, duv, pos + vec2(0, 0)),
                 find4x4(t, uv, duv, pos + vec2(4.0, 0))),
             max(find4x4(t, uv, duv, pos + vec2(0, 4.0)),
                 find4x4(t, uv, duv, pos + vec2(4.0, 4.0))));
}
lowp vec3 find8x8(sampler2D t, highp vec2 uv, highp vec2 duv) {
  return float2vec(find8x8(t, uv - duv * 4.0, duv, vec2(0, 0)));
}

void refinePos(sampler2D t, inout lowp vec2 uv, inout lowp vec2 duv, inout lowp float idx) {
  lowp vec4 counts = texture2D(t, uv);
  lowp vec4 step = step(idx, counts);
  lowp vec4 match = step * vec4(1.0, 1.0 - step.rgb);
  uv += vec2(dot(match, vec4(0, 1, 0, 1)), dot(match, vec4(0, 0, 1, 1))) * duv;
  idx -= dot(match, vec4(0.0, counts.rgb));
  duv = duv * 0.5;
}

void prog1() {
  gl_FragColor = pix(luma(texture2D8x8(t[0], uv, duv).rgb));
}
void prog2() {
  gl_FragColor = gaussian5x1(t[0], uv, vec2(duv.x, 0));
}
void prog3() {
  gl_FragColor = gaussian5x1(t[0], uv, vec2(0, duv.y));
}
void prog4() {
  gl_FragColor = pix(contrast(t[0], t[1], uv));
}
void prog5() {
  gl_FragColor = despeckle(t[0], uv, duv);
}
void prog6() {
  gl_FragColor = step(0.3, vec4(0, 0, 1, 1) + vec4(1, 1, -1, -1) * texture2D(t[0], uv).rrrr);
}
void prog7() {
  gl_FragColor = accumulateUp(t[0], uv, vec2(duv.x, 0));
}
void prog8() {
  gl_FragColor = accumulateDown(t[0], t[1], uv, vec2(1.0, 0), duv.x);
}
void prog9() {
  gl_FragColor = accumulateUp(t[0], uv, vec2(0, duv.y));
}
void prog10() {
  gl_FragColor = accumulateDown(t[0], t[1], uv, vec2(0, 1.0), duv.y);
}
void prog11() {
  lowp float prob = detect(t[0], uv, vec2(1, 0), duv.x) *
                    detect(t[1], uv, vec2(0, 1), duv.y);
  gl_FragColor = pix(step(0.02, prob) * prob);
}
void prog11b() {
  lowp vec4 center = texture2D(t[0], uv);
  gl_FragColor = step(max(max(texture2D(t[0], uv + vec2(duv.x, 0)),
                              texture2D(t[0], uv - vec2(duv.x, 0))),
                          max(texture2D(t[0], uv + vec2(0, duv.y)),
                              texture2D(t[0], uv - vec2(0, duv.y)))),
                      center) * center;  
}
void prog12() {
  lowp vec3 found = find8x8(t[0], uv, duv / 8.0);
  found = (1.0 - step(found.r, 0.0)) * found;
  gl_FragColor = vec4(found * vec3(1.0, 0.125, 0.125), 1.0);
}
void prog13() {
  gl_FragColor = texture2D(t[0], uv).rrrr / 16.0;
}
void prog14() {
  gl_FragColor = mat4(1.0, 1.0, 1.0, 1.0,
                      0.0, 1.0, 1.0, 1.0,
                      0.0, 0.0, 1.0, 1.0,
                      0.0, 0.0, 0.0, 1.0) *
                 vec4(texture2D(t[0], uv + vec2(-duv.x, -duv.y) / 4.0).a,
                      texture2D(t[0], uv + vec2(duv.x, -duv.y) / 4.0).a,
                      texture2D(t[0], uv + vec2(-duv.x, duv.y) / 4.0).a,
                      texture2D(t[0], uv + vec2(duv.x, duv.y) / 4.0).a);
}
void prog15() {
  lowp vec2 pos = step(duv, mod(uv, 2.0 * duv));
  gl_FragColor = dot(texture2D(t[0], uv),
                     vec4((1.0 - pos.x) * (1.0 - pos.y), pos.x * (1.0 - pos.y), (1.0 - pos.x) * pos.y, pos.x * pos.y)) -
                 texture2D(t[1], uv).aaaa +
                 texture2D(t[1], uv);
}
void prog16() {
  lowp float idx = (index(uv, duv) + 1.0) / 16.0;
  lowp vec2 pos = vec2(0, 0);
  lowp vec2 dpos = vec2(0.5, 0.5);
  refinePos(t[5], pos, dpos, idx);
  refinePos(t[4], pos, dpos, idx);
  refinePos(t[3], pos, dpos, idx);
  refinePos(t[2], pos, dpos, idx);
  refinePos(t[1], pos, dpos, idx);
  pos += texture2D(t[0], pos).yz * dpos * 2.0;
  gl_FragColor = vec4(pos, 0, 1);
}
void prog17() {
  lowp vec2 bl = texture2D(t[1], vec2(0, 0)).xy;
  lowp vec2 tl = texture2D(t[1], vec2(0.25, 0)).xy;
  lowp vec2 tr = texture2D(t[1], vec2(0.5, 0)).xy;
  gl_FragColor = texture2D(t[0], tl + (bl - tl) * (25.5 / 22.0 - 29.0 / 22.0 * uv.y) + (tr - tl) * (29.0 / 22.0 * uv.x - 3.5 / 22.0));
}
void prog18() {
  lowp vec2 bl = texture2D(t[1], vec2(0, 0)).xy;
  lowp vec2 tl = texture2D(t[1], vec2(0.25, 0)).xy;
  lowp vec2 tr = texture2D(t[1], vec2(0.5, 0)).xy;
  lowp vec2 uv2;
  uv2.x = dot(uv - tl, (tr - tl) / length(tr - tl) / length(tr - tl));
  uv2.y = dot(uv - tl, (bl - tl) / length(bl - tl) / length(bl - tl));
  // uv2.x = dot(uv - uv2.y * (bl - tl) - tl, (tr - tl) / length(tr - tl) / length(tr - tl));
  // uv2.y = dot(uv - uv2.x * (tr - tl) - tl, (bl - tl) / length(bl - tl) / length(bl - tl));
  uv2 = (uv2 * 22.0 + 3.5) / 29.0;
  lowp vec2 bnd = step(0.0, uv2) * (1.0 - step(1.0, uv2));
  gl_FragColor = mix(texture2D(t[0], uv), vec4(uv2, 0, 1.0), bnd.x * bnd.y);
  // lowp vec3 color = 1.0 - smoothstep(0.03, 0.05, vec3(length(uv - bl), length(uv - tl), length(uv - tr)));
  // gl_FragColor = mix(texture2D(t[0], uv), vec4(color, 1), dot(color, vec3(1.0)));
}

lowp float absmax(lowp vec2 uv) {
  return dot(uv, step(abs(uv.g), abs(uv.r)) * vec2(1.0, -1.0) + vec2(0, 1.0));
}

lowp vec2 calcAngle(sampler2D t1, sampler2D t2, highp vec2 uv, highp vec2 duvNorm1, highp float duvLen1, highp vec2 duvNorm2, highp float duvLen2) {
  lowp vec4 mid = texture2D(t1, uv);
  lowp vec4 lo = texture2D(t1, uv - duvNorm1 * (mid.a + duvLen1));
  lowp vec4 hi = texture2D(t1, uv + duvNorm1 * (mid.b + duvLen1));
  lowp vec4 lo2 = texture2D(t2, uv - duvNorm1 * (mid.a + lo.g + duvLen1));
  lowp vec4 hi2 = texture2D(t2, uv + duvNorm1 * (mid.b + hi.r + duvLen1));
  // TODO: consider flat angles!
  return vec2(atan(absmax(lo2.ba) + duvLen2, mid.a + lo.g + duvLen1),
              atan(absmax(hi2.ba) + duvLen2, mid.a + hi.r + duvLen1));
}

void prog19() {
  lowp vec2 uv2 = texture2D(t[0], uv).xy;
  gl_FragColor = vec4(calcAngle(t[1], t[2], uv2, vec2(1, 0), duv.x, vec2(0, 1), duv.y),
                      calcAngle(t[2], t[1], uv2, vec2(0, 1), duv.y, vec2(1, 0), duv.x)) / 3.14 + 0.5;
}
