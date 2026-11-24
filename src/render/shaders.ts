export const vertexShaderSource = `#version 300 es
precision highp float;

layout(location=0) in vec2 a_corner;
layout(location=1) in vec2 i_center;
layout(location=2) in vec2 i_size;
layout(location=3) in float i_angle;
layout(location=4) in vec2 i_tilt;
layout(location=5) in vec4 i_color;
layout(location=6) in vec4 i_props;
layout(location=7) in float i_seed;

uniform mat4 u_viewProj;
uniform int u_shape;
uniform float u_width;
uniform float u_height;
uniform float u_radius;

out vec2 v_local;
out vec3 v_color;
out float v_alpha;
out vec4 v_props;
out float v_seed;
flat out float v_pickId;
out vec3 v_worldPos;
out vec3 v_normal;
out vec3 v_bx;
out vec3 v_by;

const float PI = 3.14159265359;

struct Frame {
  vec3 p;
  vec3 tx;
  vec3 ty;
  vec3 n;
  float domeScale;
};

Frame wallFrame(vec2 w) {
  Frame f;
  float x = w.x - u_width * 0.5;
  float y = u_height * 0.5 - w.y;
  f.domeScale = 1.0;

  if (u_shape == 0) {
    f.p = vec3(x, y, 0.0);
    f.tx = vec3(1.0, 0.0, 0.0);
    f.ty = vec3(0.0, -1.0, 0.0);
    f.n = vec3(0.0, 0.0, 1.0);
    return f;
  }

  float radius = max(0.001, u_radius);
  float theta = x / radius;

  if (u_shape == 1) {
    f.p = vec3(radius * sin(theta), y, radius * cos(theta) - radius);
    f.tx = normalize(vec3(cos(theta), 0.0, -sin(theta)));
    f.ty = vec3(0.0, -1.0, 0.0);
    f.n = normalize(vec3(sin(theta), 0.0, cos(theta)));
    return f;
  }

  float alpha = (1.0 - clamp(w.y / u_height, 0.0, 1.0)) * PI * 0.5;
  float ca = cos(alpha);
  float sa = sin(alpha);
  f.p = vec3(radius * ca * sin(theta), -u_height * 0.5 + u_height * sa, radius * ca * cos(theta) - radius);
  vec3 txRaw = vec3(ca * cos(theta), 0.0, -ca * sin(theta));
  f.tx = length(txRaw) > 0.0001 ? normalize(txRaw) : vec3(cos(theta), 0.0, -sin(theta));
  vec3 tAlpha = normalize(vec3(-radius * sa * sin(theta), u_height * ca, -radius * sa * cos(theta)));
  f.ty = -tAlpha;
  f.n = normalize(vec3(ca * sin(theta), (radius / max(0.001, u_height)) * sa, ca * cos(theta)));
  f.domeScale = max(0.16, ca);
  return f;
}

void main() {
  Frame f = wallFrame(i_center);
  vec2 local = a_corner * i_size * 0.5;
  float c = cos(i_angle);
  float s = sin(i_angle);
  vec2 q = vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  q.x *= f.domeScale;

  vec3 yUp = normalize(cross(f.n, f.tx));
  float tiltX = clamp(i_tilt.x, -0.55, 0.55);
  float tiltY = clamp(i_tilt.y, -0.55, 0.55);

  vec3 y1 = yUp * cos(tiltX) + f.n * sin(tiltX);
  vec3 n1 = f.n * cos(tiltX) - yUp * sin(tiltX);
  vec3 x1 = f.tx * cos(tiltY) + n1 * sin(tiltY);
  vec3 n2 = normalize(n1 * cos(tiltY) - f.tx * sin(tiltY));

  vec3 offset = x1 * q.x + y1 * (-q.y);
  vec3 world = f.p + offset;

  v_local = a_corner;
  v_color = i_color.rgb;
  v_alpha = i_color.a;
  v_props = i_props;
  v_seed = i_seed;
  v_pickId = float(gl_InstanceID + 1);
  v_worldPos = world;
  v_normal = n2;
  v_bx = x1;
  v_by = -y1;

  gl_Position = u_viewProj * vec4(world, 1.0);
}
`

export const mainFragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_local;
in vec3 v_color;
in float v_alpha;
in vec4 v_props;
in float v_seed;
in vec3 v_worldPos;
in vec3 v_normal;
in vec3 v_bx;
in vec3 v_by;
flat in float v_pickId;

out vec4 outColor;

uniform vec3 u_cameraPos;
uniform float u_time;
uniform int u_selected;
uniform int u_showBlown;
uniform float u_exposure;
uniform int u_lightCount;
uniform int u_lightType[4];
uniform vec3 u_lightPos[4];
uniform vec3 u_lightDir[4];
uniform vec3 u_lightColor[4];
uniform float u_lightPower[4];
uniform float u_lightCone[4];

float hash11(float n) {
  return fract(sin(n * 127.1) * 43758.5453123);
}

void main() {
  vec3 albedo = pow(v_color, vec3(2.2));
  float roughness = clamp(v_props.x, 0.035, 1.0);
  float reflectivity = clamp(v_props.y, 0.0, 1.0);
  float relief = clamp(v_props.z, 0.0, 1.0);
  float metalness = clamp(v_props.w, 0.0, 1.0);

  vec3 N = normalize(v_normal);
  float edge = smoothstep(0.42, 1.0, max(abs(v_local.x), abs(v_local.y)));
  N = normalize(N - v_bx * v_local.x * edge * relief * 0.42 - v_by * v_local.y * edge * relief * 0.42);

  if (metalness > 0.5) {
    float hx = hash11(v_seed + 1.7);
    float hy = hash11(v_seed + 9.2);
    N = normalize(N + v_bx * (hx - 0.5) * 0.55 + v_by * (hy - 0.5) * 0.55);
  }

  vec3 V = normalize(u_cameraPos - v_worldPos);
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = mix(vec3(0.11, 0.095, 0.08), vec3(0.28, 0.34, 0.43), hemi);
  vec3 color = albedo * ambient * 0.72;

  for (int i = 0; i < 4; i++) {
    if (i >= u_lightCount) break;

    vec3 L;
    float power = u_lightPower[i];
    float attenuation = 1.0;

    if (u_lightType[i] == 0) {
      L = normalize(u_lightDir[i]);
    } else {
      vec3 toLight = u_lightPos[i] - v_worldPos;
      float distanceToLight = length(toLight);
      L = toLight / max(0.001, distanceToLight);
      attenuation = 1.0 / (1.0 + 0.16 * distanceToLight * distanceToLight);

      if (u_lightType[i] == 1) {
        float cone = dot(-L, normalize(u_lightDir[i]));
        float spot = smoothstep(u_lightCone[i] - 0.16, u_lightCone[i] + 0.03, cone);
        attenuation *= spot;
      }

      if (u_lightType[i] == 2) {
        float flicker = 1.0
          + 0.16 * sin(u_time * 8.7 + float(i) * 12.3)
          + 0.07 * sin(u_time * 21.1 + float(i) * 4.1);
        power *= flicker;
        attenuation = 1.0 / (1.0 + 0.55 * distanceToLight * distanceToLight);
      }
    }

    float ndl = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float ndh = max(dot(N, H), 0.0);
    float shininess = mix(190.0, 9.0, roughness);
    float specular = pow(ndh, shininess) * reflectivity;
    vec3 f0 = mix(vec3(0.045), albedo, metalness);

    vec3 diffuse = albedo * (1.0 - metalness * 0.72) * ndl;
    color += (diffuse + f0 * specular * 2.1) * u_lightColor[i] * power * attenuation;

    if (metalness > 0.5) {
      float glint = pow(ndh, 310.0);
      float randomFacet = 0.35 + 0.65 * hash11(v_seed * 3.17 + float(i));
      color += u_lightColor[i] * glint * reflectivity * 9.0 * randomFacet * power * attenuation;
    }
  }

  vec3 R = reflect(-V, N);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 env = mix(vec3(0.16, 0.17, 0.19), vec3(0.72, 0.83, 1.0), smoothstep(-0.3, 0.85, R.y));
  float windowBand = pow(max(0.0, 1.0 - abs(R.x * 0.8 + R.z * 0.15)), 22.0) * smoothstep(0.05, 0.85, R.y);
  env += vec3(1.0, 0.91, 0.70) * windowBand * 1.5;
  color += env * reflectivity * (0.16 + 0.55 * fresnel) * (1.0 - roughness * 0.58);

  if (u_selected >= 0 && abs(v_pickId - float(u_selected + 1)) < 0.5) {
    float outline = smoothstep(0.72, 0.98, max(abs(v_local.x), abs(v_local.y)));
    color = mix(color, vec3(0.1, 0.92, 1.0) * 1.4, outline * 0.9);
  }

  color *= u_exposure;
  color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
  color = pow(color, vec3(1.0 / 2.2));

  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float maxChannel = max(max(color.r, color.g), color.b);
  float minChannel = min(min(color.r, color.g), color.b);
  float saturation = maxChannel > 0.001 ? (maxChannel - minChannel) / maxChannel : 0.0;
  float deadWhite = smoothstep(0.84, 0.95, luminance) * (1.0 - smoothstep(0.06, 0.22, saturation));

  if (u_showBlown == 1) {
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 16.0));
    vec3 warning = mix(vec3(1.0, 0.72, 0.05), vec3(1.0, 0.08, 0.24), stripe);
    color = mix(color, warning, deadWhite * 0.78);
  }

  outColor = vec4(color, v_alpha);
}
`

export const pickFragmentShaderSource = `#version 300 es
precision highp float;

flat in float v_pickId;
out vec4 outId;

void main() {
  if (v_pickId < 0.5) discard;
  float id = v_pickId;
  float r = mod(id, 256.0);
  float g = mod(floor(id / 256.0), 256.0);
  float b = floor(id / 65536.0);
  outId = vec4(r / 255.0, g / 255.0, b / 255.0, 1.0);
}
`
