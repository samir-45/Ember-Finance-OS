// ============================================================
// EMBER FINANCE OS — Dynamic Background & Atmosphere Engine
// ============================================================

'use client';

import { useState, useEffect } from 'react';

export type BackgroundPresetId = 'tudsa' | 'textured_flame' | 'subtle_mesh' | 'plasma' | 'nebula' | 'custom';

export interface BackgroundConfig {
  presetId: BackgroundPresetId;
  customImageDataUrl: string | null;
  customImageName: string | null;
  enableSparks: boolean;
  brightness: number; // 50 - 140 (%)
  blur: number; // 0 - 20 (px)
}

export interface PresetOption {
  id: BackgroundPresetId;
  name: string;
  tagline: string;
  previewGradient: string;
  isDefault?: boolean;
}

export const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'tudsa',
    name: 'Molten Ember (TudSa)',
    tagline: 'Your custom radiant fluted flame curtain',
    previewGradient: 'linear-gradient(180deg, #fff2cc 0%, #ff6a00 35%, #990c00 65%, #050507 100%)',
    isDefault: true,
  },
  {
    id: 'textured_flame',
    name: 'Tactile Roaring Fire',
    tagline: 'Living dancing flames with analog film grain & velvet vignette',
    previewGradient: 'radial-gradient(circle at 65% 35%, #ffe066 0%, #ff4d00 38%, #b30c00 68%, #050507 95%)',
  },
  {
    id: 'subtle_mesh',
    name: 'Subtle Obsidian Hearth',
    tagline: 'Subtle black with glowing radial ember mesh & dot matrix',
    previewGradient: 'radial-gradient(ellipse at 85% 20%, rgba(255, 90, 35, 0.6) 0%, rgba(185, 28, 28, 0.4) 40%, #070709 90%)',
  },
  {
    id: 'plasma',
    name: 'Living Plasma Fire',
    tagline: 'Procedural full-color morphing flame plumes',
    previewGradient: 'radial-gradient(circle at 70% 30%, #ffcc00 0%, #ff3b00 45%, #660000 80%, #050507 100%)',
  },
  {
    id: 'nebula',
    name: 'Cosmic Stardust',
    tagline: 'Galactic electric embers and stellar dust',
    previewGradient: 'linear-gradient(135deg, #2b0404 0%, #ff3700 25%, #4a0e4e 65%, #050507 100%)',
  },
];

const STORAGE_KEY = 'ember_bg_config';
const EVENT_NAME = 'ember_bg_changed';

export const DEFAULT_BG_CONFIG: BackgroundConfig = {
  presetId: 'tudsa',
  customImageDataUrl: null,
  customImageName: null,
  enableSparks: true,
  brightness: 100,
  blur: 0,
};

export function getBackgroundConfig(): BackgroundConfig {
  if (typeof window === 'undefined') return DEFAULT_BG_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BG_CONFIG;
    const parsed = JSON.parse(raw);
    const validIds: BackgroundPresetId[] = ['tudsa', 'textured_flame', 'subtle_mesh', 'plasma', 'nebula', 'custom'];
    if (!validIds.includes(parsed.presetId)) {
      parsed.presetId = 'tudsa';
    }
    return { ...DEFAULT_BG_CONFIG, ...parsed };
  } catch {
    return DEFAULT_BG_CONFIG;
  }
}

export function saveBackgroundConfig(config: BackgroundConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: config }));
  } catch (err) {
    console.error('Failed to save background config:', err);
  }
}

export function useBackground(): [BackgroundConfig, (cfg: BackgroundConfig) => void] {
  const [config, setConfig] = useState<BackgroundConfig>(DEFAULT_BG_CONFIG);

  useEffect(() => {
    setConfig(getBackgroundConfig());
    const handler = (e: Event) => {
      const custom = e as CustomEvent<BackgroundConfig>;
      if (custom.detail) {
        setConfig(custom.detail);
      } else {
        setConfig(getBackgroundConfig());
      }
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const update = (newCfg: BackgroundConfig) => {
    setConfig(newCfg);
    saveBackgroundConfig(newCfg);
  };

  return [config, update];
}

export function compressImageFile(file: File, maxDim = 1920, quality = 0.86): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Cannot get canvas 2D context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
