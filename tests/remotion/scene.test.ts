import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {SCENE_FADE_FRAMES, SCENE_WASH_OPACITY, sceneOpacity} from '../../src/remotion/Scene';

describe('sceneOpacity', () => {
  it('fades in from black and out to black when both edges are enabled', () => {
    expect(sceneOpacity(0, 120, {fadeIn: true, fadeOut: true})).toBe(0);
    expect(sceneOpacity(SCENE_FADE_FRAMES, 120, {fadeIn: true, fadeOut: true})).toBe(1);
    expect(sceneOpacity(119, 120, {fadeIn: true, fadeOut: true})).toBeLessThan(1);
    expect(sceneOpacity(120, 120, {fadeIn: true, fadeOut: true})).toBe(0);
  });

  it('stays fully visible at the start when fade-in is disabled', () => {
    expect(sceneOpacity(0, 120, {fadeIn: false, fadeOut: true})).toBe(1);
    expect(sceneOpacity(SCENE_FADE_FRAMES, 120, {fadeIn: false, fadeOut: true})).toBe(1);
  });

  it('stays fully visible at the end when fade-out is disabled', () => {
    expect(sceneOpacity(114, 120, {fadeIn: true, fadeOut: false})).toBe(1);
    expect(sceneOpacity(119, 120, {fadeIn: true, fadeOut: false})).toBe(1);
  });

  it('never fades a single-scene clip from or to black', () => {
    expect(sceneOpacity(0, 150, {fadeIn: false, fadeOut: false})).toBe(1);
    expect(sceneOpacity(75, 150, {fadeIn: false, fadeOut: false})).toBe(1);
    expect(sceneOpacity(149, 150, {fadeIn: false, fadeOut: false})).toBe(1);
  });
});

describe('scene wash', () => {
  it('leaves footage undimmed', () => {
    expect(SCENE_WASH_OPACITY).toBe(0);
  });
});

describe('V5 clip presentation', () => {
  it('mutes imported video and disables decorative zoom', () => {
    const src = readFileSync('src/remotion/Scene.tsx', 'utf8');
    expect(src).toMatch(/\n\s+muted\n/);
    expect(src).toContain('scene.proofAssetId || scene.disableVideoZoom ? 1 : videoScale');
    expect(SCENE_WASH_OPACITY).toBe(0);
  });
});
