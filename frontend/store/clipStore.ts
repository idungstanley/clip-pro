import { create } from 'zustand';

export interface VideoMeta {
  path: string;
  filename: string;
  duration: number;
  size_mb: number;
  width: number | null;
  height: number | null;
  fps: number;
  codec: string | null;
  audio_codec: string | null;
  thumbnail_url: string | null;
}

export interface TextLayer {
  id: string;
  text: string;
  x_pct: number;
  y_pct: number;
  font: string;
  size: number;
  color: string;
  alpha: number;
  stroke_color: string;
  stroke_width: number;
  animation: string;
  start_sec: number;
  end_sec: number;
}

export interface Moment {
  id: string;
  start_time: number;
  end_time: number;
  viral_score: number;
  reason: string;
  transcript: string;
  scene_type: string;
  thumbnail: string | null;
  audio_energy: number;
  motion_score: number;
  face_intensity: number;
  // User edits
  trim_start?: number;
  trim_end?: number;
  text_layers?: TextLayer[];
  selected?: boolean;
  rendered_url?: string;
  rendered_size_mb?: number;
}

export interface ExportSettings {
  output_format: 'mp4' | 'mov' | 'webm' | 'mkv' | 'gif';
  resolution: 'original' | '720p' | '1080p' | '2K' | '4K';
  aspect_ratio: 'original' | '9:16' | '1:1' | '16:9';
  crf: number;
  upscale: boolean;
  upscale_target: '1080p' | '2K' | '4K';
  output_dir: string;
  clip_count: number;
}

interface ClipStore {
  // Video
  video: VideoMeta | null;
  setVideo: (v: VideoMeta | null) => void;

  // Moments
  moments: Moment[];
  setMoments: (m: Moment[]) => void;
  updateMoment: (id: string, patch: Partial<Moment>) => void;
  toggleSelect: (id: string) => void;
  selectTopN: (n: number) => void;
  reorderMoments: (from: number, to: number) => void;

  // Active clip in editor
  activeClipId: string | null;
  setActiveClipId: (id: string | null) => void;

  // Export settings
  exportSettings: ExportSettings;
  setExportSettings: (patch: Partial<ExportSettings>) => void;

  // Analysis job
  analysisJobId: string | null;
  setAnalysisJobId: (id: string | null) => void;

  // Render results
  renderJobId: string | null;
  setRenderJobId: (id: string | null) => void;

  // Reset
  reset: () => void;
}

const defaultExport: ExportSettings = {
  output_format: 'mp4',
  resolution: 'original',
  aspect_ratio: 'original',
  crf: 23,
  upscale: false,
  upscale_target: '4K',
  output_dir: '',
  clip_count: 5,
};

export const useClipStore = create<ClipStore>((set, get) => ({
  video: null,
  setVideo: (v) => set({ video: v }),

  moments: [],
  setMoments: (m) => set({ moments: m }),
  updateMoment: (id, patch) =>
    set((s) => ({
      moments: s.moments.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  toggleSelect: (id) =>
    set((s) => ({
      moments: s.moments.map((m) =>
        m.id === id ? { ...m, selected: !m.selected } : m
      ),
    })),
  selectTopN: (n) =>
    set((s) => ({
      moments: s.moments.map((m, i) => ({ ...m, selected: i < n })),
    })),
  reorderMoments: (from, to) =>
    set((s) => {
      const arr = [...s.moments];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return { moments: arr };
    }),

  activeClipId: null,
  setActiveClipId: (id) => set({ activeClipId: id }),

  exportSettings: defaultExport,
  setExportSettings: (patch) =>
    set((s) => ({ exportSettings: { ...s.exportSettings, ...patch } })),

  analysisJobId: null,
  setAnalysisJobId: (id) => set({ analysisJobId: id }),

  renderJobId: null,
  setRenderJobId: (id) => set({ renderJobId: id }),

  reset: () =>
    set({
      video: null,
      moments: [],
      activeClipId: null,
      exportSettings: defaultExport,
      analysisJobId: null,
      renderJobId: null,
    }),
}));
