'use client';

import { useClipStore } from '@/store/clipStore';

const FORMATS = ['mp4', 'mov', 'webm', 'mkv', 'gif'] as const;
const RESOLUTIONS = ['original', '720p', '1080p', '2K', '4K'] as const;
const ASPECTS = ['original', '9:16', '1:1', '16:9'] as const;

export default function FormatSelector() {
  const { exportSettings: s, setExportSettings: set } = useClipStore();

  return (
    <div className="space-y-5">
      {/* Format */}
      <div>
        <p className="text-xs text-muted mb-2">Output Format</p>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => set({ output_format: f })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors uppercase
                ${s.output_format === f
                  ? 'border-gold text-gold bg-gold/10'
                  : 'border-border text-muted hover:border-white/30 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution */}
      <div>
        <p className="text-xs text-muted mb-2">Resolution</p>
        <div className="flex flex-wrap gap-2">
          {RESOLUTIONS.map((r) => (
            <button
              key={r}
              onClick={() => set({ resolution: r })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                ${s.resolution === r
                  ? 'border-gold text-gold bg-gold/10'
                  : 'border-border text-muted hover:border-white/30 hover:text-white'}`}
            >
              {r === 'original' ? 'Original' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div>
        <p className="text-xs text-muted mb-2">Aspect Ratio</p>
        <div className="flex flex-wrap gap-2">
          {ASPECTS.map((a) => (
            <button
              key={a}
              onClick={() => set({ aspect_ratio: a })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                ${s.aspect_ratio === a
                  ? 'border-gold text-gold bg-gold/10'
                  : 'border-border text-muted hover:border-white/30 hover:text-white'}`}
            >
              {a === 'original' ? 'Original' : a}
            </button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div>
        <p className="text-xs text-muted mb-2">
          Quality — CRF {s.crf} ({s.crf <= 20 ? 'Best' : s.crf <= 24 ? 'Good' : 'Small file'})
        </p>
        <input
          type="range" min={18} max={28} value={s.crf}
          onChange={(e) => set({ crf: +e.target.value })}
          className="w-full accent-gold"
        />
        <div className="flex justify-between text-[10px] text-muted mt-1">
          <span>18 — Highest Quality</span>
          <span>28 — Smallest File</span>
        </div>
      </div>

      {/* Upscale */}
      <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">4K Upscaling (Real-ESRGAN)</p>
          <p className="text-xs text-muted">Free, local AI upscaling. Slow — GPU recommended.</p>
        </div>
        <div className="flex items-center gap-3">
          {s.upscale && (
            <select
              value={s.upscale_target}
              onChange={(e) => set({ upscale_target: e.target.value as any })}
              className="bg-surface border border-border rounded px-2 py-1 text-sm text-white"
            >
              <option value="1080p">1080p</option>
              <option value="2K">2K</option>
              <option value="4K">4K</option>
            </select>
          )}
          <button
            onClick={() => set({ upscale: !s.upscale })}
            className={`relative w-11 h-6 rounded-full transition-colors
              ${s.upscale ? 'bg-gold' : 'bg-border'}`}
          >
            <span
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
              style={{ transform: s.upscale ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      </div>

      {/* Clip count */}
      <div>
        <p className="text-xs text-muted mb-2">Number of clips to export ({s.clip_count})</p>
        <input
          type="range" min={1} max={20} value={s.clip_count}
          onChange={(e) => set({ clip_count: +e.target.value })}
          className="w-full accent-gold"
        />
      </div>
    </div>
  );
}
