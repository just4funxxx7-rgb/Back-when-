import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { isSoftwareGl } from './materials';

export type GraphicsPresetType = '8k_ultra' | 'unreal5' | 'unity_hdrp' | 'performance';

export interface EngineGraphicsConfig {
  preset: GraphicsPresetType;
  renderScale: number;
  casEnabled: boolean;
  casSharpness: number;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  vignetteEnabled: boolean;
  vignetteDarkness: number;
  fxaaEnabled: boolean;
  chromaticAberration: boolean;
  chromaticStrength: number;
  motionBlurDecay: number;
  wetnessSheen: boolean;
}

export const DEFAULT_GRAPHICS_CONFIG: EngineGraphicsConfig = {
  preset: '8k_ultra',
  renderScale: isSoftwareGl ? 1.0 : 2.0,
  casEnabled: !isSoftwareGl,
  casSharpness: 0.85,
  bloomEnabled: !isSoftwareGl,
  bloomStrength: 0.72,
  bloomRadius: 0.48,
  bloomThreshold: 0.8,
  vignetteEnabled: true,
  vignetteDarkness: 1.12,
  fxaaEnabled: !isSoftwareGl,
  chromaticAberration: !isSoftwareGl,
  chromaticStrength: 0.0022,
  motionBlurDecay: 0.85,
  wetnessSheen: true,
};

// 8K FidelityFX Contrast Adaptive Sharpening (CAS) Shader for Sub-Pixel Micro-Detail Clarity
const CASSharpenShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
    sharpness: { value: 0.85 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float sharpness;
    varying vec2 vUv;

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, -resolution.y)).rgb;
      vec3 s = texture2D(tDiffuse, vUv + vec2(0.0, resolution.y)).rgb;
      vec3 w = texture2D(tDiffuse, vUv + vec2(-resolution.x, 0.0)).rgb;
      vec3 e = texture2D(tDiffuse, vUv + vec2(resolution.x, 0.0)).rgb;

      // Min/Max local neighborhood contrast for artifact-free 8K edge sharpening
      vec3 minRGB = min(min(n, s), min(min(w, e), c));
      vec3 maxRGB = max(max(n, s), max(max(w, e), c));

      vec3 laplacian = (4.0 * c) - (n + s + w + e);
      float localContrast = clamp(1.0 - length(maxRGB - minRGB) * 0.65, 0.25, 1.0);
      vec3 sharpened = clamp(c + laplacian * (sharpness * 0.42 * localContrast), 0.0, 1.0);

      gl_FragColor = vec4(sharpened, 1.0);
    }
  `,
};

// Chromatic Aberration Shader for Unreal-style lens optics
const ChromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.0022 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - 0.5;
      float dist = length(dir);
      float r = texture2D(tDiffuse, vUv - dir * amount * dist).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + dir * amount * dist).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export class UnrealRenderPipeline {
  public composer: EffectComposer | null = null;
  public renderPass!: RenderPass;
  public bloomPass!: UnrealBloomPass;
  public casPass!: ShaderPass;
  public vignettePass!: ShaderPass;
  public chromaticPass!: ShaderPass;
  public fxaaPass!: ShaderPass;
  public config: EngineGraphicsConfig = { ...DEFAULT_GRAPHICS_CONFIG };
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    if (!isSoftwareGl) {
      this.initComposer();
    }
  }

  private initComposer() {
    const width = this.renderer.domElement.clientWidth || window.innerWidth;
    const height = this.renderer.domElement.clientHeight || window.innerHeight;
    const pixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio * (this.config.renderScale / 1.5), 2.5);
    this.renderer.setPixelRatio(pixelRatio);

    // Use full 16-bit float render target for 8K HDR bloom and precision
    const renderTarget = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
    });

    this.composer = new EffectComposer(this.renderer, renderTarget);

    // 1. Scene Render Pass
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // 2. Unreal HDR Bloom Pass
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      this.config.bloomStrength,
      this.config.bloomRadius,
      this.config.bloomThreshold
    );
    this.bloomPass.enabled = this.config.bloomEnabled;
    this.composer.addPass(this.bloomPass);

    // 3. 8K FidelityFX Contrast Adaptive Sharpening (CAS) Pass
    this.casPass = new ShaderPass(CASSharpenShader);
    this.casPass.uniforms.resolution.value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
    this.casPass.uniforms.sharpness.value = this.config.casSharpness;
    this.casPass.enabled = this.config.casEnabled;
    this.composer.addPass(this.casPass);

    // 4. Chromatic Aberration Lens Distortion
    this.chromaticPass = new ShaderPass(ChromaticShader);
    this.chromaticPass.uniforms.amount.value = this.config.chromaticStrength;
    this.chromaticPass.enabled = this.config.chromaticAberration;
    this.composer.addPass(this.chromaticPass);

    // 5. Filmic Vignette Pass
    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms.offset.value = 0.95;
    this.vignettePass.uniforms.darkness.value = this.config.vignetteDarkness;
    this.vignettePass.enabled = this.config.vignetteEnabled;
    this.composer.addPass(this.vignettePass);

    // 6. FXAA Anti-Aliasing (Final Pass)
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
    this.fxaaPass.enabled = this.config.fxaaEnabled;
    this.composer.addPass(this.fxaaPass);
  }

  public applyPreset(preset: GraphicsPresetType) {
    this.config.preset = preset;
    if (preset === '8k_ultra') {
      this.config.renderScale = isSoftwareGl ? 1.0 : 2.0;
      this.config.casEnabled = !isSoftwareGl;
      this.config.casSharpness = 0.92;
      this.config.bloomEnabled = !isSoftwareGl;
      this.config.bloomStrength = 0.72;
      this.config.bloomRadius = 0.48;
      this.config.bloomThreshold = 0.8;
      this.config.vignetteEnabled = true;
      this.config.vignetteDarkness = 1.12;
      this.config.chromaticAberration = !isSoftwareGl;
      this.config.chromaticStrength = 0.0022;
      this.renderer.toneMappingExposure = 1.18;
    } else if (preset === 'unreal5') {
      this.config.renderScale = isSoftwareGl ? 1.0 : 1.6;
      this.config.casEnabled = !isSoftwareGl;
      this.config.casSharpness = 0.65;
      this.config.bloomEnabled = !isSoftwareGl;
      this.config.bloomStrength = 0.75;
      this.config.bloomRadius = 0.5;
      this.config.bloomThreshold = 0.8;
      this.config.vignetteEnabled = true;
      this.config.vignetteDarkness = 1.25;
      this.config.chromaticAberration = !isSoftwareGl;
      this.config.chromaticStrength = 0.0035;
      this.renderer.toneMappingExposure = 1.15;
    } else if (preset === 'unity_hdrp') {
      this.config.renderScale = isSoftwareGl ? 1.0 : 1.35;
      this.config.casEnabled = !isSoftwareGl;
      this.config.casSharpness = 0.5;
      this.config.bloomEnabled = !isSoftwareGl;
      this.config.bloomStrength = 0.5;
      this.config.bloomRadius = 0.35;
      this.config.bloomThreshold = 0.85;
      this.config.vignetteEnabled = true;
      this.config.vignetteDarkness = 0.95;
      this.config.chromaticAberration = false;
      this.renderer.toneMappingExposure = 1.08;
    } else {
      // Mobile / Performance
      this.config.renderScale = 1.0;
      this.config.casEnabled = false;
      this.config.bloomEnabled = false;
      this.config.vignetteEnabled = false;
      this.config.chromaticAberration = false;
      this.renderer.toneMappingExposure = 1.05;
    }

    if (!isSoftwareGl) {
      const pixelRatio = Math.min(window.devicePixelRatio * (this.config.renderScale / 1.5), 2.5);
      this.renderer.setPixelRatio(pixelRatio);
      const w = this.renderer.domElement.clientWidth || window.innerWidth;
      const h = this.renderer.domElement.clientHeight || window.innerHeight;
      this.setSize(w, h);
    }

    if (this.casPass) {
      this.casPass.enabled = this.config.casEnabled;
      this.casPass.uniforms.sharpness.value = this.config.casSharpness;
    }
    if (this.bloomPass) {
      this.bloomPass.enabled = this.config.bloomEnabled;
      this.bloomPass.strength = this.config.bloomStrength;
    }
    if (this.vignettePass) {
      this.vignettePass.enabled = this.config.vignetteEnabled;
      this.vignettePass.uniforms.darkness.value = this.config.vignetteDarkness;
    }
    if (this.chromaticPass) {
      this.chromaticPass.enabled = this.config.chromaticAberration;
    }
  }

  public setSize(width: number, height: number) {
    if (this.composer) {
      this.composer.setSize(width, height);
      const pixelRatio = this.renderer.getPixelRatio();
      if (this.fxaaPass) {
        this.fxaaPass.material.uniforms['resolution'].value.set(
          1 / (width * pixelRatio),
          1 / (height * pixelRatio)
        );
      }
      if (this.casPass) {
        this.casPass.uniforms.resolution.value.set(
          1 / (width * pixelRatio),
          1 / (height * pixelRatio)
        );
      }
      if (this.bloomPass) {
        this.bloomPass.resolution.set(width, height);
      }
    }
  }

  public render() {
    if (this.composer && !isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
