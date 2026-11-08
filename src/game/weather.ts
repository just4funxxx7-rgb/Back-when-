import * as THREE from 'three';
import { WeatherType } from '../types/game';

export interface WeatherState {
  timeOfDay: number; // 0 to 24 hours
  dayCount: number;
  currentWeather: WeatherType;
  ambientTemperature: number; // in Celsius
  windSpeed: number; // 0.0 to 3.0
  lightningFlash: number; // 0 to 1
}

export class DynamicWeatherSystem {
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;
  private scene: THREE.Scene;
  private weatherParticles: THREE.Points;
  private particleGeo: THREE.BufferGeometry;
  private particleCount = 1200;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;

  public state: WeatherState = {
    timeOfDay: 9.0, // Start mid-morning
    dayCount: 1,
    currentWeather: 'clear',
    ambientTemperature: 21,
    windSpeed: 0.8,
    lightningFlash: 0,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Directional Sun / Moon key light with tight shadow bounds
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 180;
    const d = 45;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    // Warm Key vs Cool Sky Fill
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d382e, 0.7);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0x222233, 0.3);
    this.scene.add(this.ambientLight);

    // Exponential Fog matched to sky
    this.scene.fog = new THREE.FogExp2(0xc2d6e8, 0.0085);

    // Weather Particles (Rain / Blizzard / Ash)
    this.particleGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      this.particlePositions[i * 3] = (Math.random() - 0.5) * 80;
      this.particlePositions[i * 3 + 1] = Math.random() * 35;
      this.particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      this.particleVelocities[i * 3] = (Math.random() - 0.5) * 0.2;
      this.particleVelocities[i * 3 + 1] = -0.5 - Math.random() * 0.5;
      this.particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }

    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x99ccff,
      size: 0.18,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.weatherParticles = new THREE.Points(this.particleGeo, particleMat);
    this.scene.add(this.weatherParticles);
  }

  public setWeather(weather: WeatherType) {
    this.state.currentWeather = weather;
  }

  public update(delta: number, playerPos: THREE.Vector3) {
    // Progress 24-hour clock: 1 real second = ~0.08 in-game minutes (full day ~ 18 mins, adjustable)
    this.state.timeOfDay += delta * 0.05;
    if (this.state.timeOfDay >= 24) {
      this.state.timeOfDay -= 24;
      this.state.dayCount += 1;
    }

    // Solar angle calculation
    const sunAngle = ((this.state.timeOfDay - 6) / 24) * Math.PI * 2;
    const sunDistance = 80;
    const sunX = Math.cos(sunAngle) * sunDistance;
    const sunY = Math.sin(sunAngle) * sunDistance;
    const sunZ = Math.sin(sunAngle * 0.5) * 20;

    this.sunLight.position.set(playerPos.x + sunX, Math.max(sunY, -30), playerPos.z + sunZ);
    this.sunLight.target.position.copy(playerPos);
    this.sunLight.target.updateMatrixWorld();

    const isDay = sunY > 0;
    const dayProgress = Math.max(0, Math.min(1, (sunY + 10) / 40));

    // Dynamic sky & fog coloring
    let skyColor = new THREE.Color(0x0a0e1a); // Night
    let fogColor = new THREE.Color(0x0a0e1a);
    let sunColor = new THREE.Color(0xffe8c2);
    let sunIntensity = 1.6;

    if (this.state.timeOfDay >= 5 && this.state.timeOfDay < 8) {
      // Dawn / Sunrise
      skyColor.setHex(0xe07a5f);
      fogColor.setHex(0xd08a75);
      sunColor.setHex(0xff7744);
      sunIntensity = 1.2;
    } else if (this.state.timeOfDay >= 8 && this.state.timeOfDay < 17) {
      // Daylight
      skyColor.setHex(0x87ceeb);
      fogColor.setHex(0xb5d8eb);
      sunColor.setHex(0xfffaed);
      sunIntensity = 1.9;
    } else if (this.state.timeOfDay >= 17 && this.state.timeOfDay < 20) {
      // Sunset
      skyColor.setHex(0x9d4edd);
      fogColor.setHex(0xc77dff);
      sunColor.setHex(0xff6b6b);
      sunIntensity = 1.3;
    }

    // Weather modifiers
    let baseTemp = 18;
    const particleMat = this.weatherParticles.material as THREE.PointsMaterial;

    if (this.state.currentWeather === 'rain' || this.state.currentWeather === 'storm') {
      skyColor.lerp(new THREE.Color(0x2d3748), 0.7);
      fogColor.lerp(new THREE.Color(0x374151), 0.8);
      sunIntensity *= 0.35;
      baseTemp -= 6;
      this.state.windSpeed = 1.5;

      particleMat.opacity = THREE.MathUtils.damp(particleMat.opacity, 0.75, 2, delta);
      particleMat.color.setHex(0x93c5fd);
      particleMat.size = 0.22;

      // Random lightning flash in storms
      if (this.state.currentWeather === 'storm' && Math.random() < 0.008) {
        this.state.lightningFlash = 1.0;
      }
    } else if (this.state.currentWeather === 'blizzard') {
      skyColor.setHex(0xdbeafe);
      fogColor.setHex(0xeff6ff);
      sunIntensity *= 0.25;
      baseTemp -= 18; // Sub-zero chill!
      this.state.windSpeed = 2.4;

      particleMat.opacity = THREE.MathUtils.damp(particleMat.opacity, 0.9, 2, delta);
      particleMat.color.setHex(0xffffff);
      particleMat.size = 0.35;
    } else if (this.state.currentWeather === 'ash_tempest') {
      skyColor.setHex(0x451a03);
      fogColor.setHex(0x78350f);
      sunIntensity *= 0.4;
      baseTemp += 5;
      this.state.windSpeed = 1.8;

      particleMat.opacity = THREE.MathUtils.damp(particleMat.opacity, 0.8, 2, delta);
      particleMat.color.setHex(0xd97706);
      particleMat.size = 0.28;
    } else {
      particleMat.opacity = THREE.MathUtils.damp(particleMat.opacity, 0.0, 3, delta);
      this.state.windSpeed = 0.6;
    }

    // Decay lightning flash
    if (this.state.lightningFlash > 0) {
      this.state.lightningFlash = Math.max(0, this.state.lightningFlash - delta * 4);
      skyColor.lerp(new THREE.Color(0xffffff), this.state.lightningFlash);
      sunIntensity += this.state.lightningFlash * 4.0;
    }

    // Apply lighting
    this.scene.background = skyColor;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(fogColor);
      this.scene.fog.density = this.state.currentWeather === 'blizzard' ? 0.025 : 0.007;
    }

    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = isDay ? sunIntensity : 0.2; // Moonlight
    this.hemiLight.color.copy(skyColor);
    this.hemiLight.intensity = isDay ? 0.6 : 0.25;

    // Ambient Temperature Calculation
    const diurnalSwing = Math.sin(sunAngle) * 8; // Warmer at noon, colder at night
    this.state.ambientTemperature = Math.round(baseTemp + diurnalSwing);

    // Update Particles around player
    if (particleMat.opacity > 0.05) {
      const posAttr = this.particleGeo.attributes.position as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;

      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        positions[idx] += this.particleVelocities[idx] + (this.state.windSpeed * 0.4);
        positions[idx + 1] += this.particleVelocities[idx + 1] * (this.state.currentWeather === 'blizzard' ? 0.4 : 1.2);
        positions[idx + 2] += this.particleVelocities[idx + 2];

        // Wrap around player box (±40 units)
        if (positions[idx + 1] < 0) positions[idx + 1] = 30;
        if (positions[idx] - playerPos.x > 40) positions[idx] -= 80;
        if (positions[idx] - playerPos.x < -40) positions[idx] += 80;
        if (positions[idx + 2] - playerPos.z > 40) positions[idx + 2] -= 80;
        if (positions[idx + 2] - playerPos.z < -40) positions[idx + 2] += 80;
      }
      posAttr.needsUpdate = true;
    }
  }
}
