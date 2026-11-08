import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { isSoftwareGl } from './materials';

export interface EngineGraphicsConfig {
  preset: 'unreal5' | 'unity_hdrp' | 'performance';
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
  preset: 'unreal5',
  bloomEnabled: !isSoftwareGl,
  bloomStrength: 0.65,
  bloomRadius: 0.45,
  bloomThreshold: 0.82,
  vignetteEnabled: true,
  vignetteDarkness: 1.15,
  fxaaEnabled: !isSoftwareGl,
  chromaticAberration: !isSoftwareGl,
  chromaticStrength: 0.0025,
  motionBlurDecay: 0.85,
  wetnessSheen: true,
};

// Chromatic Aberration Shader for Unreal-style lens optics
const ChromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.0025 },
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

    // Use full 16-bit float render target for HDR bloom
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
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

    // 3. Chromatic Aberration Lens Distortion
    this.chromaticPass = new ShaderPass(ChromaticShader);
    this.chromaticPass.uniforms.amount.value = this.config.chromaticStrength;
    this.chromaticPass.enabled = this.config.chromaticAberration;
    this.composer.addPass(this.chromaticPass);

    // 4. Filmic Vignette Pass
    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms.offset.value = 0.95;
    this.vignettePass.uniforms.darkness.value = this.config.vignetteDarkness;
    this.vignettePass.enabled = this.config.vignetteEnabled;
    this.composer.addPass(this.vignettePass);

    // 5. FXAA Anti-Aliasing (Final Pass)
    this.fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = this.renderer.getPixelRatio();
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
    this.fxaaPass.enabled = this.config.fxaaEnabled;
    this.composer.addPass(this.fxaaPass);
  }

  public applyPreset(preset: 'unreal5' | 'unity_hdrp' | 'performance') {
    this.config.preset = preset;
    if (preset === 'unreal5') {
      this.config.bloomEnabled = true;
      this.config.bloomStrength = 0.75;
      this.config.bloomRadius = 0.5;
      this.config.bloomThreshold = 0.8;
      this.config.vignetteEnabled = true;
      this.config.vignetteDarkness = 1.25;
      this.config.chromaticAberration = true;
      this.config.chromaticStrength = 0.0035;
      this.renderer.toneMappingExposure = 1.15;
    } else if (preset === 'unity_hdrp') {
      this.config.bloomEnabled = true;
      this.config.bloomStrength = 0.5;
      this.config.bloomRadius = 0.35;
      this.config.bloomThreshold = 0.85;
      this.config.vignetteEnabled = true;
      this.config.vignetteDarkness = 0.95;
      this.config.chromaticAberration = false;
      this.renderer.toneMappingExposure = 1.05;
    } else {
      // Performance
      this.config.bloomEnabled = false;
      this.config.vignetteEnabled = false;
      this.config.chromaticAberration = false;
      this.renderer.toneMappingExposure = 1.0;
    }

    if (this.bloomPass) this.bloomPass.enabled = this.config.bloomEnabled;
    if (this.bloomPass) this.bloomPass.strength = this.config.bloomStrength;
    if (this.vignettePass) this.vignettePass.enabled = this.config.vignetteEnabled;
    if (this.vignettePass) this.vignettePass.uniforms.darkness.value = this.config.vignetteDarkness;
    if (this.chromaticPass) this.chromaticPass.enabled = this.config.chromaticAberration;
  }

  public setSize(width: number, height: number) {
    if (this.composer) {
      this.composer.setSize(width, height);
      if (this.fxaaPass) {
        const pixelRatio = this.renderer.getPixelRatio();
        this.fxaaPass.material.uniforms['resolution'].value.set(
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
