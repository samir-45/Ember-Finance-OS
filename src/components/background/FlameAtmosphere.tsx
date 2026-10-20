'use client';

import { useBackground } from '@/lib/background';
import { SparksCanvas } from './SparksCanvas';

export function FlameAtmosphere() {
  const [config] = useBackground();

  const bgFilter =
    `brightness(${config.brightness}%) ${config.blur > 0 ? `blur(${config.blur}px)` : ''}`.trim();

  const isCustom = config.presetId === 'custom' && config.customImageDataUrl;
  const isTudsa =
    config.presetId === 'tudsa' || (config.presetId === 'custom' && !config.customImageDataUrl);
  const isTexturedFlame = config.presetId === 'textured_flame';
  const isSubtleMesh = config.presetId === 'subtle_mesh';
  const isPlasma = config.presetId === 'plasma';
  const isNebula = config.presetId === 'nebula';

  return (
    <div className="flame-backdrop-root" aria-hidden="true">
      {/* Base Canvas */}
      <div className="flame-base-black" />

      {/* Preset: TudSa.webp (Default) */}
      {isTudsa && (
        <div
          className="flame-image-layer"
          style={{
            backgroundImage: "url('/TudSa.webp')",
            filter: bgFilter,
          }}
        />
      )}

      {/* Preset: Custom Uploaded Image */}
      {isCustom && (
        <div
          className="flame-image-layer"
          style={{
            backgroundImage: `url('${config.customImageDataUrl}')`,
            filter: bgFilter,
          }}
        />
      )}

      {/* Preset: Tactile Roaring Fire */}
      {isTexturedFlame && (
        <div style={{ position: 'absolute', inset: 0, filter: bgFilter }}>
          <div className="flame-plumes-container">
            <div className="flame-tongue-1" />
            <div className="flame-tongue-2" />
            <div className="flame-tongue-3" />
            <div className="flame-tongue-4" />
            <div className="flame-tongue-5" />
          </div>
          <div className="flame-texture-overlay" />
          <div className="flame-vignette" />
        </div>
      )}

      {/* Preset: Subtle Obsidian Hearth */}
      {isSubtleMesh && (
        <div style={{ position: 'absolute', inset: 0, filter: bgFilter }}>
          <div className="flame-subtle-mesh-layer" />
          <div className="flame-texture-overlay" />
        </div>
      )}

      {/* Preset: Living Plasma Fire */}
      {isPlasma && (
        <div
          className="flame-plumes-container"
          style={{
            filter: bgFilter ? `${bgFilter} blur(52px) saturate(210%) contrast(135%)` : undefined,
          }}
        >
          <div className="flame-tongue-1" />
          <div className="flame-tongue-2" />
          <div className="flame-tongue-3" />
          <div className="flame-tongue-4" />
          <div className="flame-tongue-5" />
        </div>
      )}

      {/* Preset: Cosmic Stardust */}
      {isNebula && <div className="flame-nebula-layer" style={{ filter: bgFilter }} />}

      {/* Floating Ember Sparks Canvas */}
      {config.enableSparks && <SparksCanvas />}
    </div>
  );
}
