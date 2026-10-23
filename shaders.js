/**
 * SteadyHands — WebGL2 GLSL Studio Shaders
 * 1. MetaballFluidShader: Smooth refractive metaball liquid with analytical 3D normals,
 *    Fresnel studio reflections, caustics, and Beer-Lambert subsurface absorption.
 * 2. FerrofluidShader: Multi-pole 3D normal-mapped Rosensweig magnetic ferrofluid
 *    with spiky crowns, inter-finger magnetic bridges, and iridescent liquid-metal shading.
 */

const VERT_SRC = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FLUID_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform int uMode; // 0 = water, 1 = elixir, 2 = zerog, 3 = chrome
uniform int uCount;
uniform vec4 uBalls[160]; // xy: pixel pos (top-left origin), z: radius, w: colorMix (0..1)
uniform vec4 uVessels[3]; // xy: center, z: halfWidth, w: halfHeight
uniform vec3 uVesselTilts; // rotation angles in radians for the 3 vessels

// Signed distance to a rounded U-shaped glass vessel (open at top)
float sdGlassCup(vec2 p, vec2 center, vec2 halfSize, float angle, out vec2 localP) {
  vec2 d = p - center;
  float c = cos(-angle);
  float s = sin(-angle);
  localP = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  vec2 q = abs(localP) - halfSize + vec2(18.0);
  float boxDist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 18.0;
  // Wall thickness around the perimeter (open top when localP.y < -halfSize.y + 12.0)
  float wall = abs(boxDist) - 4.5;
  if (localP.y < -halfSize.y + 8.0 && abs(localP.x) < halfSize.x - 6.0) {
    wall = 100.0;
  }
  return wall;
}

vec3 studioEnv(vec3 R) {
  // Overhead studio softbox + cyan left fill + warm amber right rim
  float softbox = smoothstep(0.35, 0.92, R.y) * smoothstep(0.65, 0.1, abs(R.x));
  float rimLeft = pow(max(0.0, -R.x * 0.7 + R.y * 0.3), 3.0);
  float rimRight = pow(max(0.0, R.x * 0.75 + R.y * 0.2), 3.0);
  float horizon = exp(-abs(R.y) * 5.0);
  vec3 col = vec3(0.05, 0.08, 0.13);
  col += vec3(0.95, 0.98, 1.0) * softbox * 1.45;
  col += vec3(0.18, 0.78, 0.98) * rimLeft * 0.65;
  col += vec3(0.98, 0.62, 0.24) * rimRight * 0.55;
  col += vec3(0.16, 0.26, 0.42) * horizon * 0.45;
  return col;
}

void main() {
  // Convert vUv (bottom-left) to canvas pixel coords (top-left origin)
  vec2 p = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);

  // Subtle dark studio background with radial vignette + fine refraction caustics grid
  vec2 normCentered = (p - uRes * 0.5) / uRes.y;
  float vig = 1.0 - dot(normCentered, normCentered) * 0.75;
  vec3 bg = mix(vec3(0.03, 0.045, 0.07), vec3(0.08, 0.12, 0.18), clamp(vig, 0.0, 1.0));
  float gridX = smoothstep(0.96, 1.0, cos(p.x * 0.12));
  float gridY = smoothstep(0.96, 1.0, cos(p.y * 0.12));
  bg += vec3(0.025, 0.045, 0.07) * max(gridX, gridY) * 0.5;

  // Evaluate metaball scalar field F(p) and analytical gradient dF/dp
  float field = 0.0;
  vec2 grad = vec2(0.0);
  float mixAcc = 0.0;
  float weightSum = 0.0;

  for (int i = 0; i < 160; i++) {
    if (i >= uCount) break;
    vec4 b = uBalls[i];
    vec2 diff = p - b.xy;
    float r2 = b.z * b.z;
    float d2 = dot(diff, diff) + 75.0;
    float contrib = r2 / d2;
    field += contrib;
    // Derivative of r^2 / (d^2 + eps) is -2 * r^2 * diff / (d^2 + eps)^2
    grad -= (2.0 * r2 / (d2 * d2)) * diff;
    mixAcc += contrib * b.w;
    weightSum += contrib;
  }

  float avgMix = weightSum > 0.0001 ? (mixAcc / weightSum) : 0.0;

  // Smooth liquid surface boundary around threshold = 1.0
  float iso = 1.0;
  float alpha = smoothstep(iso - 0.16, iso + 0.12, field);

  vec3 finalCol = bg;
  float outAlpha = 0.0;

  if (alpha > 0.005) {
    // 3D normal from analytical gradient of metaball field
    vec2 g = grad * 26.0;
    float nz = sqrt(max(0.12, 1.0 - min(0.88, dot(g, g) * 0.14)));
    // Flip Y for top-down light coords
    vec3 N = normalize(vec3(g.x, -g.y, nz));
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 R = reflect(-V, N);

    // Refracted background lookup + internal caustic pattern
    vec2 refrP = p + N.xy * 28.0;
    float caustic = sin(refrP.x * 0.09 + uTime * 2.4) * cos(refrP.y * 0.09 - uTime * 1.9);
    caustic = pow(max(0.0, caustic * 0.5 + 0.5), 3.0);

    // Thickness factor from field value
    float thickness = clamp((field - iso) * 0.55, 0.0, 1.6);

    vec3 liquidBase;
    vec3 deepTint;
    if (uMode == 0) {
      // Crystal Spring Water
      liquidBase = mix(vec3(0.22, 0.82, 0.99), vec3(0.04, 0.48, 0.82), clamp(thickness * 0.7, 0.0, 1.0));
      deepTint = vec3(0.02, 0.22, 0.45);
    } else if (uMode == 1) {
      // Two-Tone Glowing Alchemical Elixir (Cyan-Gold + Neon Rose-Violet)
      vec3 cA = vec3(0.15, 0.92, 0.85);
      vec3 cB = vec3(0.96, 0.26, 0.68);
      vec3 cC = vec3(0.99, 0.75, 0.22);
      liquidBase = mix(cA, cB, smoothstep(0.15, 0.85, avgMix));
      liquidBase = mix(liquidBase, cC, sin(avgMix * 3.14159) * 0.38);
      deepTint = liquidBase * 0.35;
    } else if (uMode == 2) {
      // Zero-G Bioluminescent Plasma Globes
      vec3 cA = vec3(0.38, 0.45, 0.98);
      vec3 cB = vec3(0.18, 0.96, 0.76);
      liquidBase = mix(cA, cB, avgMix);
      deepTint = vec3(0.08, 0.14, 0.36);
    } else {
      // Liquid Chrome / Mercury
      liquidBase = vec3(0.84, 0.89, 0.95);
      deepTint = vec3(0.25, 0.30, 0.38);
    }

    vec3 envCol = studioEnv(R);
    float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.6);

    // Key studio softbox specular + secondary warm rim specular
    vec3 L1 = normalize(vec3(-0.38, 0.62, 0.68));
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(0.0, dot(N, H1)), 96.0) * 1.35;

    vec3 L2 = normalize(vec3(0.52, -0.35, 0.77));
    vec3 H2 = normalize(L2 + V);
    float spec2 = pow(max(0.0, dot(N, H2)), 48.0) * 0.55;

    vec3 refractedCol = mix(bg * 1.25, liquidBase, 0.76);
    refractedCol = mix(refractedCol, deepTint, clamp(thickness * 0.5, 0.0, 0.75));
    refractedCol += liquidBase * caustic * 0.32;

    if (uMode == 3) {
      // Pure metallic liquid chrome
      refractedCol = mix(vec3(0.18, 0.22, 0.28), envCol * 1.25, 0.85);
    }

    vec3 shaded = mix(refractedCol, envCol, clamp(fresnel * 0.85 + 0.12, 0.0, 1.0));
    shaded += vec3(1.0, 0.99, 0.96) * spec1;
    shaded += (uMode == 1 ? vec3(1.0, 0.65, 0.88) : vec3(0.55, 0.88, 1.0)) * spec2;

    // Crisp glowing meniscus rim
    float rimGlow = smoothstep(iso + 0.45, iso, field) * alpha;
    shaded += liquidBase * rimGlow * 0.35;

    finalCol = mix(bg, shaded, alpha);
    outAlpha = alpha;
  }

  // Render 3D Refractive Borosilicate Glass Vessels in the shader
  float tilts[3] = float[3](uVesselTilts.x, uVesselTilts.y, uVesselTilts.z);
  for (int i = 0; i < 3; i++) {
    vec4 v = uVessels[i];
    if (v.z <= 1.0) continue;
    vec2 lp;
    float dWall = sdGlassCup(p, v.xy, v.zw, tilts[i], lp);
    if (dWall < 2.0) {
      float wAlpha = smoothstep(2.0, -1.2, dWall);
      float sideHighlight = smoothstep(0.0, 1.0, abs(lp.x) / max(1.0, v.z));
      vec3 glassCol = mix(vec3(0.55, 0.82, 0.98), vec3(0.96, 0.99, 1.0), sideHighlight);
      finalCol = mix(finalCol, glassCol, wAlpha * 0.58);
      outAlpha = max(outAlpha, wAlpha * 0.85);
    }
    // Subtle inner glass reflection sheen across vessel body
    if (abs(lp.x) < v.z - 4.0 && abs(lp.y) < v.w - 4.0) {
      float streak = exp(-pow((lp.x + v.z * 0.58) * 0.06, 2.0)) * 0.16;
      finalCol += vec3(0.75, 0.92, 1.0) * streak;
      outAlpha = max(outAlpha, streak);
    }
  }

  fragColor = vec4(finalCol, max(outAlpha, 1.0));
}
`;

const FERRO_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform int uPoleCount;
uniform vec4 uPoles[6]; // xy: pixel pos, z: strength, w: radius
uniform vec3 uAccent;

// Smooth minimum (polynomial smin) for fusing magnetic ferrofluid pools & bridges
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k * (1.0 / 6.0);
}

// Evaluate 3D ferrofluid heightfield at pixel coordinate p
float ferroHeight(vec2 p) {
  vec2 center = uRes * 0.5;
  // Base central magnetic containment well
  float dBase = length(p - center);
  float field = 0.0;

  for (int i = 0; i < 6; i++) {
    if (i >= uPoleCount) break;
    vec4 pole = uPoles[i];
    vec2 diff = p - pole.xy;
    float d = length(diff);
    float r = pole.w;
    // Smooth Gaussian + inverse-distance magnetic dome
    float dome = pole.z * exp(-(d * d) / (r * r * 1.15));

    // Rosensweig hexagonal + radial spike instability wave around each magnetic pole
    float angle = atan(diff.y, diff.x);
    float radialWave = cos(d * 0.24 - uTime * 3.6 + float(i) * 1.3);
    float angularWave = cos(angle * 14.0 + sin(d * 0.09 - uTime * 2.0) * 2.2);
    float angular2 = cos(angle * 23.0 - uTime * 1.4);
    float spikes = pow(max(0.0, 0.52 + 0.48 * radialWave * (0.65 * angularWave + 0.35 * angular2)), 2.2);

    float spikeAmp = pole.z * smoothstep(r * 1.45, r * 0.1, d) * (0.45 + 0.85 * smoothstep(0.0, r * 0.55, d));
    field += dome * 0.82 + spikes * spikeAmp * 0.78;
  }

  // Inter-pole magnetic bridge spikes when 2+ fingers are active
  if (uPoleCount >= 2) {
    vec2 a = uPoles[0].xy;
    vec2 b = uPoles[1].xy;
    vec2 ab = b - a;
    float lenAB = max(1.0, length(ab));
    if (lenAB < 480.0) {
      float t = clamp(dot(p - a, ab) / (lenAB * lenAB), 0.0, 1.0);
      vec2 proj = a + t * ab;
      float dLine = length(p - proj);
      float bridgeEnv = exp(-(dLine * dLine) / 2200.0) * sin(t * 3.14159) * (1.0 - lenAB / 520.0);
      float bridgeRibs = 0.5 + 0.5 * cos(t * lenAB * 0.28 - uTime * 4.0) * cos(dLine * 0.18);
      field += max(0.0, bridgeEnv) * (0.65 + 0.75 * bridgeRibs) * 1.15;
    }
  }

  return field;
}

vec3 studioEnvFerro(vec3 R, vec3 accent) {
  float softbox1 = smoothstep(0.25, 0.92, R.y) * smoothstep(0.75, 0.08, abs(R.x));
  float softbox2 = smoothstep(0.15, 0.85, -R.y) * 0.35;
  float rim = pow(1.0 - abs(R.z), 3.0);
  vec3 col = vec3(0.03, 0.04, 0.06);
  col += vec3(0.98, 0.99, 1.0) * softbox1 * 1.65;
  col += accent * softbox2 * 1.1;
  col += mix(accent, vec3(0.98, 0.72, 0.28), 0.45) * rim * 0.85;
  return col;
}

void main() {
  vec2 p = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
  vec2 center = uRes * 0.5;
  float dCenter = length(p - center);

  // Machined anodized magnetic dish background with concentric field rings
  float dishR = uRes.x * 0.44;
  vec3 bg = mix(vec3(0.055, 0.075, 0.11), vec3(0.025, 0.035, 0.055), smoothstep(0.0, dishR, dCenter));
  float ring = smoothstep(0.95, 1.0, cos(dCenter * 0.14 - uTime * 1.2));
  bg += uAccent * ring * 0.05 * smoothstep(dishR, 0.0, dCenter);

  float h = ferroHeight(p);
  float eps = 2.2;
  float hx = ferroHeight(p + vec2(eps, 0.0)) - ferroHeight(p - vec2(eps, 0.0));
  float hy = ferroHeight(p + vec2(0.0, eps)) - ferroHeight(p - vec2(0.0, eps));

  // Threshold between dry dish carrier fluid and raised 3D ferrofluid pool
  float mask = smoothstep(0.22, 0.31, h);

  vec3 col = bg;
  if (mask > 0.002) {
    vec3 N = normalize(vec3(-hx * 28.0, hy * 28.0, 1.0));
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 R = reflect(-V, N);

    float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.2);
    vec3 env = studioEnvFerro(R, uAccent);

    // Thin-film iridescent oil-on-metal color shift based on normal angle & height
    float iridPhase = dot(N.xy, vec2(1.4, -1.1)) * 2.5 + h * 2.2;
    vec3 irid = 0.5 + 0.5 * cos(iridPhase + vec3(0.0, 2.1, 4.2));

    vec3 L1 = normalize(vec3(-0.35, 0.58, 0.73));
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(0.0, dot(N, H1)), 88.0) * 1.5;

    vec3 L2 = normalize(vec3(0.48, -0.45, 0.75));
    vec3 H2 = normalize(L2 + V);
    float spec2 = pow(max(0.0, dot(N, H2)), 42.0) * 0.75;

    vec3 metalBase = mix(vec3(0.03, 0.04, 0.065), env, 0.78);
    metalBase = mix(metalBase, irid * uAccent * 1.4, fresnel * 0.58);
    metalBase += vec3(1.0, 0.99, 0.97) * spec1;
    metalBase += uAccent * spec2;

    // Contact shadow & glowing meniscus around the ferrofluid boundary
    float edgeGlow = smoothstep(0.45, 0.24, h) * mask;
    metalBase += uAccent * edgeGlow * 0.42;

    col = mix(bg * (1.0 - 0.35 * mask), metalBase, mask);
  } else {
    // Subtle magnetic carrier fluid ripples outside the main ferrofluid mass
    vec3 Nbg = normalize(vec3(-hx * 8.0, hy * 8.0, 1.0));
    float specBg = pow(max(0.0, dot(Nbg, normalize(vec3(-0.3, 0.5, 0.85)))), 48.0);
    col += uAccent * specBg * 0.25;
  }

  // Outer machined bezel ring of the magnetic containment dish
  float bezel = smoothstep(dishR + 8.0, dishR, dCenter) * smoothstep(dishR - 10.0, dishR - 2.0, dCenter);
  col = mix(col, vec3(0.28, 0.36, 0.48), bezel * 0.65);

  fragColor = vec4(col, 1.0);
}
`;

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(s));
  }
  return s;
}

function createProgram(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(p));
  }
  return p;
}

export class StudioShaderPipeline {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 720;
    this.canvas.height = 820;
    this.gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });

    if (!this.gl) return;
    const gl = this.gl;

    // Fullscreen quad
    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    // 1. Metaball Fluid Program
    this.fluidProg = createProgram(gl, VERT_SRC, FLUID_FRAG_SRC);
    this.fluidLocs = {
      aPos: gl.getAttribLocation(this.fluidProg, 'aPos'),
      uRes: gl.getUniformLocation(this.fluidProg, 'uRes'),
      uTime: gl.getUniformLocation(this.fluidProg, 'uTime'),
      uMode: gl.getUniformLocation(this.fluidProg, 'uMode'),
      uCount: gl.getUniformLocation(this.fluidProg, 'uCount'),
      uBalls: gl.getUniformLocation(this.fluidProg, 'uBalls[0]'),
      uVessels: gl.getUniformLocation(this.fluidProg, 'uVessels[0]'),
      uVesselTilts: gl.getUniformLocation(this.fluidProg, 'uVesselTilts')
    };
    this.ballArray = new Float32Array(160 * 4);
    this.vesselArray = new Float32Array(3 * 4);

    // 2. Ferrofluid Program
    this.ferroProg = createProgram(gl, VERT_SRC, FERRO_FRAG_SRC);
    this.ferroLocs = {
      aPos: gl.getAttribLocation(this.ferroProg, 'aPos'),
      uRes: gl.getUniformLocation(this.ferroProg, 'uRes'),
      uTime: gl.getUniformLocation(this.ferroProg, 'uTime'),
      uPoleCount: gl.getUniformLocation(this.ferroProg, 'uPoleCount'),
      uPoles: gl.getUniformLocation(this.ferroProg, 'uPoles[0]'),
      uAccent: gl.getUniformLocation(this.ferroProg, 'uAccent')
    };
    this.poleArray = new Float32Array(6 * 4);
  }

  renderFluid(targetCtx, width, height, timeSec, modeInt, balls, vessels = []) {
    if (!this.gl) return false;
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.fluidProg);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.fluidLocs.aPos);
    gl.vertexAttribPointer(this.fluidLocs.aPos, 2, gl.FLOAT, false, 0, 0);

    const count = Math.min(160, balls.length);
    for (let i = 0; i < count; i++) {
      const b = balls[i];
      const idx = i * 4;
      this.ballArray[idx] = b.x;
      this.ballArray[idx + 1] = b.y;
      this.ballArray[idx + 2] = b.r;
      this.ballArray[idx + 3] = b.hueShift ?? 0;
    }

    for (let i = 0; i < 3; i++) {
      const v = vessels[i];
      const idx = i * 4;
      if (v) {
        this.vesselArray[idx] = v.x;
        this.vesselArray[idx + 1] = v.y;
        this.vesselArray[idx + 2] = v.w * 0.5;
        this.vesselArray[idx + 3] = v.h * 0.5;
      } else {
        this.vesselArray[idx + 2] = 0;
      }
    }

    gl.uniform2f(this.fluidLocs.uRes, width, height);
    gl.uniform1f(this.fluidLocs.uTime, timeSec);
    gl.uniform1i(this.fluidLocs.uMode, modeInt);
    gl.uniform1i(this.fluidLocs.uCount, count);
    gl.uniform4fv(this.fluidLocs.uBalls, this.ballArray);
    gl.uniform4fv(this.fluidLocs.uVessels, this.vesselArray);
    gl.uniform3f(
      this.fluidLocs.uVesselTilts,
      vessels[0]?.angle || 0,
      vessels[1]?.angle || 0,
      vessels[2]?.angle || 0
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    targetCtx.drawImage(this.canvas, 0, 0, width, height);
    return true;
  }

  renderFerrofluid(targetCtx, width, height, timeSec, poles, accentRGB = [0.22, 0.74, 0.97]) {
    if (!this.gl) return false;
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.ferroProg);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.ferroLocs.aPos);
    gl.vertexAttribPointer(this.ferroLocs.aPos, 2, gl.FLOAT, false, 0, 0);

    const count = Math.min(6, poles.length);
    for (let i = 0; i < count; i++) {
      const p = poles[i];
      const idx = i * 4;
      this.poleArray[idx] = p.x;
      this.poleArray[idx + 1] = p.y;
      this.poleArray[idx + 2] = p.strength;
      this.poleArray[idx + 3] = p.radius || 180.0;
    }

    gl.uniform2f(this.ferroLocs.uRes, width, height);
    gl.uniform1f(this.ferroLocs.uTime, timeSec);
    gl.uniform1i(this.ferroLocs.uPoleCount, count);
    gl.uniform4fv(this.ferroLocs.uPoles, this.poleArray);
    gl.uniform3f(this.ferroLocs.uAccent, accentRGB[0], accentRGB[1], accentRGB[2]);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    targetCtx.drawImage(this.canvas, 0, 0, width, height);
    return true;
  }
}
