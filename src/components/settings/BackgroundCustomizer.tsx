'use client';

import {
  DEFAULT_BG_CONFIG,
  PRESET_OPTIONS,
  compressImageFile,
  useBackground,
  type BackgroundPresetId,
} from '@/lib/background';
import { Check, RotateCcw, Sparkles, UploadCloud } from 'lucide-react';
import { useRef } from 'react';

export function BackgroundCustomizer() {
  const [bgConfig, setBgConfig] = useBackground();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectPreset = (id: BackgroundPresetId) => {
    setBgConfig({
      ...bgConfig,
      presetId: id,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024)
      throw new Error('Choose an image smaller than 10 MB');

    try {
      const dataUrl = await compressImageFile(file, 1920, 0.88);
      setBgConfig({
        ...bgConfig,
        presetId: 'custom',
        customImageDataUrl: dataUrl,
        customImageName: file.name,
      });
    } catch (err) {
      console.error('Failed to process image:', err);
      alert('Could not process this image file. Please try another format (.jpg, .png, .webp).');
    }
  };

  const handleResetToDefault = () => {
    setBgConfig({
      ...DEFAULT_BG_CONFIG,
    });
  };

  return (
    <div className="appearance-editor">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Background & Atmosphere</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Choose a curated fire preset, or upload your own custom photo
          </p>
        </div>
        <button
          onClick={handleResetToDefault}
          className="btn btn-secondary btn-sm"
          title="Restore original Ember background"
        >
          <RotateCcw size={14} />
          Reset to Default
        </button>
      </div>

      {/* Preset Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {PRESET_OPTIONS.map((opt) => {
          const isSelected = bgConfig.presetId === opt.id;
          return (
            <div
              key={opt.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectPreset(opt.id);
                }
              }}
              onClick={() => handleSelectPreset(opt.id)}
              style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                border: isSelected
                  ? '2px solid var(--color-accent)'
                  : '1px solid var(--border-subtle)',
                background: isSelected ? 'rgba(255, 59, 31, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                transition: 'all 200ms ease',
              }}
            >
              {/* Visual Thumbnail */}
              <div
                style={{
                  height: 90,
                  borderRadius: 8,
                  marginBottom: 12,
                  background:
                    opt.id === 'tudsa'
                      ? "url('/TudSa.webp') center top / cover no-repeat"
                      : opt.previewGradient,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                }}
              >
                {opt.isDefault && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(0,0,0,0.7)',
                      color: '#ffb380',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Default
                  </span>
                )}
                {isSelected && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--color-accent)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={14} />
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: isSelected ? '#fff' : 'var(--text-primary)',
                }}
              >
                {opt.name}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {opt.tagline}
              </p>
            </div>
          );
        })}

        {/* Custom Upload Card */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload custom background"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            position: 'relative',
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            padding: 14,
            border:
              bgConfig.presetId === 'custom'
                ? '2px solid var(--color-accent)'
                : '1px dashed var(--border-bright)',
            background:
              bgConfig.presetId === 'custom'
                ? 'rgba(255, 59, 31, 0.08)'
                : 'rgba(255, 255, 255, 0.02)',
            transition: 'all 200ms ease',
          }}
        >
          <div
            style={{
              height: 90,
              borderRadius: 8,
              marginBottom: 12,
              background: bgConfig.customImageDataUrl
                ? `url('${bgConfig.customImageDataUrl}') center / cover no-repeat`
                : 'rgba(255, 255, 255, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            }}
          >
            {!bgConfig.customImageDataUrl && (
              <>
                <UploadCloud size={24} style={{ color: 'var(--color-accent)', marginBottom: 4 }} />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Click to upload
                </span>
              </>
            )}
            {bgConfig.presetId === 'custom' && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={14} />
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Custom Photo</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {bgConfig.customImageName || 'Upload any image from your computer'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>
      </div>

      {/* Atmosphere Controls (Sparks & Sliders) */}
      <div
        style={{
          paddingTop: 20,
          borderTop: '1px solid var(--border-subtle)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: 20,
          alignItems: 'center',
        }}
      >
        {/* Ember Sparks Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: bgConfig.enableSparks
                  ? 'rgba(255,59,31,0.15)'
                  : 'rgba(255,255,255,0.05)',
                color: bgConfig.enableSparks ? 'var(--color-accent)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Drifting Ember Sparks</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Floating ambient particles
              </p>
            </div>
          </div>
          <button
            aria-pressed={bgConfig.enableSparks}
            aria-label="Drifting ember sparks"
            onClick={() => setBgConfig({ ...bgConfig, enableSparks: !bgConfig.enableSparks })}
            className={`btn btn-sm ${bgConfig.enableSparks ? 'btn-primary' : 'btn-secondary'}`}
          >
            {bgConfig.enableSparks ? 'Active' : 'Muted'}
          </button>
        </div>

        {/* Brightness Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Brightness
            </span>
            <span
              className="ember-number"
              style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}
            >
              {bgConfig.brightness}%
            </span>
          </div>
          <input
            aria-label="Background brightness"
            type="range"
            min="50"
            max="140"
            value={bgConfig.brightness}
            onChange={(e) => setBgConfig({ ...bgConfig, brightness: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--color-accent)' }}
          />
        </div>

        {/* Soft Blur Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Soft Blur</span>
            <span
              className="ember-number"
              style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}
            >
              {bgConfig.blur}px
            </span>
          </div>
          <input
            aria-label="Background blur"
            type="range"
            min="0"
            max="20"
            value={bgConfig.blur}
            onChange={(e) => setBgConfig({ ...bgConfig, blur: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--color-accent)' }}
          />
        </div>
      </div>
    </div>
  );
}
