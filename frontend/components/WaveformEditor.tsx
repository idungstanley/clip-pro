'use client';

import { useEffect, useRef, useState } from 'react';
import { Moment } from '@/store/clipStore';
import { useClipStore } from '@/store/clipStore';
import { backendUrl, withKey } from '@/lib/api';

interface Props {
  moment: Moment;
  videoPath: string;
}

const PRESETS = [15, 30, 45, 60];

export default function WaveformEditor({ moment, videoPath }: Props) {
  const { updateMoment } = useClipStore();
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);
  const [wsReady, setWsReady] = useState(false);

  const trimStart = moment.trim_start ?? moment.start_time;
  const trimEnd = moment.trim_end ?? moment.end_time;
  const duration = trimEnd - trimStart;

  useEffect(() => {
    if (!waveRef.current) return;

    let ws: any;

    import('wavesurfer.js').then((WaveSurferModule) => {
      const WaveSurfer = WaveSurferModule.default;

      ws = WaveSurfer.create({
        container: waveRef.current!,
        waveColor: '#F5C518',
        progressColor: '#b8941a',
        cursorColor: '#ef4444',
        height: 64,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        backend: 'WebAudio',
      });

      wsRef.current = ws;

      const url = withKey(backendUrl(`/api/video/stream?api_key=5bf4de01b2163020a62d842b6fa1905a411626e934deb92d3b8f61876c623866&path=${encodeURIComponent(videoPath)}`));
      ws.load(url, undefined, undefined, trimStart);

      ws.on('ready', () => setWsReady(true));
      ws.on('error', (e: any) => console.warn('[WaveSurfer]', e));
    });

    return () => {
      ws?.destroy();
    };
  }, [videoPath, moment.id]);

  const setTrimStart = (v: number) =>
    updateMoment(moment.id, { trim_start: Math.max(moment.start_time, Math.min(v, trimEnd - 1)) });

  const setTrimEnd = (v: number) =>
    updateMoment(moment.id, { trim_end: Math.min(moment.end_time, Math.max(v, trimStart + 1)) });

  const applyPreset = (secs: number) => {
    const newEnd = Math.min(trimStart + secs, moment.end_time);
    updateMoment(moment.id, { trim_end: newEnd });
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {/* Waveform */}
      <div className="bg-surface rounded-lg p-3 border border-border">
        <div ref={waveRef} className="rounded overflow-hidden" />
        {!wsReady && (
          <div className="h-16 flex items-center justify-center text-muted text-sm">
            Loading waveform...
          </div>
        )}
      </div>

      {/* IN/OUT sliders */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted w-8">IN</span>
          <input
            type="range"
            min={moment.start_time}
            max={moment.end_time}
            step={0.1}
            value={trimStart}
            onChange={(e) => setTrimStart(parseFloat(e.target.value))}
            className="flex-1 accent-gold"
          />
          <span className="text-xs text-gold font-mono w-12 text-right">{fmtTime(trimStart)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted w-8">OUT</span>
          <input
            type="range"
            min={moment.start_time}
            max={moment.end_time}
            step={0.1}
            value={trimEnd}
            onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
            className="flex-1 accent-gold"
          />
          <span className="text-xs text-gold font-mono w-12 text-right">{fmtTime(trimEnd)}</span>
        </div>
      </div>

      {/* Duration & presets */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Duration: <strong className="text-white">{duration.toFixed(1)}s</strong></span>
        <div className="flex gap-1.5 ml-auto">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors
                ${duration === p
                  ? 'border-gold text-gold'
                  : 'border-border text-muted hover:border-white/30 hover:text-white'}`}
            >
              {p}s
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
