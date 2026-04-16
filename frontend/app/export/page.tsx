'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FolderOpen, Package, Play, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import StepNav from '@/components/StepNav';
import ProgressTracker from '@/components/ProgressTracker';
import FormatSelector from '@/components/FormatSelector';
import { useClipStore, Moment } from '@/store/clipStore';
import { useJobStatus } from '@/hooks/useJobStatus';
import { backendUrl, withKey } from '@/lib/api';

interface RenderResult {
  clip_id: string;
  path?: string;
  url?: string;
  size_mb?: number;
  format?: string;
  error?: string;
}

export default function ExportPage() {
  const { video, moments, exportSettings, setExportSettings, setRenderJobId, renderJobId, updateMoment } = useClipStore();
  const router = useRouter();
  const [rendering, setRendering] = useState(false);
  const [results, setResults] = useState<RenderResult[]>([]);
  const [zipping, setZipping] = useState(false);

  const { progress, stage, message, done, error, result, stageChecklist, completedStages } = useJobStatus(
    rendering ? renderJobId : null
  );

  useEffect(() => {
    if (!video) router.replace('/');
  }, [video, router]);

  const selectedClips = moments.filter((m) => m.selected);

  const startRender = useCallback(async () => {
    if (!video || selectedClips.length === 0) return;
    setRendering(true);
    setResults([]);

    const clips = selectedClips.slice(0, exportSettings.clip_count).map((m) => ({
      clip_id: m.id,
      video_path: video.path,
      start_time: m.trim_start ?? m.start_time,
      end_time: m.trim_end ?? m.end_time,
      text_layers: m.text_layers ?? [],
      output_format: exportSettings.output_format,
      resolution: exportSettings.resolution === 'original' ? null : exportSettings.resolution,
      aspect_ratio: exportSettings.aspect_ratio === 'original' ? null : exportSettings.aspect_ratio,
      crf: exportSettings.crf,
      upscale: exportSettings.upscale,
      upscale_target: exportSettings.upscale_target,
      output_dir: exportSettings.output_dir || null,
    }));

    const res = await fetch('/api/render/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips }),
    });
    const data = await res.json();
    setRenderJobId(data.job_id);
  }, [video, selectedClips, exportSettings, setRenderJobId]);

  useEffect(() => {
    if (done && result?.clips) {
      setResults(result.clips);
      setRendering(false);
      // Update store with rendered URLs
      result.clips.forEach((r: RenderResult) => {
        if (r.url) updateMoment(r.clip_id, { rendered_url: r.url, rendered_size_mb: r.size_mb });
      });
    }
  }, [done, result]);

  const downloadZip = async () => {
    setZipping(true);
    const res = await fetch('/api/export/zip');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'viralclips.zip';
    a.click();
    URL.revokeObjectURL(url);
    setZipping(false);
  };

  const openFolder = async () => {
    await fetch('/api/export/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: exportSettings.output_dir || '' }),
    });
  };

  if (!video) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <StepNav />

      <div className="flex-1 flex">
        {/* Left: Settings + controls */}
        <aside className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-white">Export Settings</h2>
            <p className="text-xs text-muted mt-0.5">
              {selectedClips.length} clip{selectedClips.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <FormatSelector />

            {/* Output dir */}
            <div className="mt-5 space-y-1.5">
              <p className="text-xs text-muted">Output Directory (leave blank for default)</p>
              <input
                type="text"
                placeholder="/Users/you/Desktop/clips"
                value={exportSettings.output_dir}
                onChange={(e) => setExportSettings({ output_dir: e.target.value })}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted outline-none focus:border-gold/50"
              />
            </div>
          </div>

          <div className="p-4 border-t border-border space-y-2">
            <button
              onClick={startRender}
              disabled={rendering || selectedClips.length === 0}
              className="w-full py-2.5 bg-gold text-black font-semibold rounded-lg hover:bg-gold-dim transition-colors disabled:opacity-40 text-sm flex items-center justify-center gap-2"
            >
              {rendering ? (
                <>
                  <RotateCcw size={15} className="animate-spin" /> Rendering...
                </>
              ) : (
                <>
                  <Play size={15} /> Render {Math.min(selectedClips.length, exportSettings.clip_count)} Clips
                </>
              )}
            </button>

            {results.length > 0 && (
              <>
                <button
                  onClick={downloadZip}
                  disabled={zipping}
                  className="w-full py-2 border border-border text-white text-sm rounded-lg hover:border-white/40 transition-colors flex items-center justify-center gap-2"
                >
                  <Package size={14} /> {zipping ? 'Zipping...' : 'Download All as ZIP'}
                </button>
                <button
                  onClick={openFolder}
                  className="w-full py-2 border border-border text-white text-sm rounded-lg hover:border-white/40 transition-colors flex items-center justify-center gap-2"
                >
                  <FolderOpen size={14} /> Open Output Folder
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Right: Progress + results */}
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Progress tracker */}
          <AnimatePresence>
            {rendering && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass rounded-xl p-5"
              >
                <h3 className="text-sm font-semibold text-white mb-4">Rendering Progress</h3>
                <ProgressTracker
                  progress={progress}
                  stage={stage}
                  message={message}
                  done={done}
                  error={error}
                  stageChecklist={stageChecklist}
                  completedStages={completedStages}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results grid */}
          {results.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success" />
                {results.filter((r) => !r.error).length} clips ready
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((r, i) => {
                  const moment = moments.find((m) => m.id === r.clip_id);
                  return (
                    <motion.div
                      key={r.clip_id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass rounded-xl overflow-hidden"
                    >
                      {r.error ? (
                        <div className="p-4 flex items-center gap-3 text-danger">
                          <AlertCircle size={16} />
                          <span className="text-sm">{r.error}</span>
                        </div>
                      ) : (
                        <>
                          {/* Inline preview */}
                          <div className="bg-black aspect-video">
                            <video
                              src={withKey(backendUrl(r.url ?? ''))}
                              controls
                              className="w-full h-full object-contain"
                            />
                          </div>

                          <div className="p-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm text-white font-medium">
                                {moment?.scene_type ?? 'Clip'} · {r.size_mb?.toFixed(1)}MB
                              </p>
                              <p className="text-xs text-muted uppercase">{r.format}</p>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={withKey(backendUrl(`/api/export/download/${r.url?.split('/').pop()}`))}
                                download
                                className="flex items-center gap-1 px-3 py-1.5 bg-gold text-black text-xs font-semibold rounded-lg hover:bg-gold-dim transition-colors"
                              >
                                <Download size={12} /> Download
                              </a>
                              <button
                                onClick={() => {
                                  useClipStore.getState().setActiveClipId(r.clip_id);
                                  router.push('/text-editor');
                                }}
                                className="px-3 py-1.5 border border-border text-white text-xs rounded-lg hover:border-white/40 transition-colors"
                              >
                                Re-edit
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!rendering && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
              <Download size={40} className="text-muted/40" />
              <p className="text-muted text-sm">
                {selectedClips.length === 0
                  ? 'No clips selected. Go back to Studio and select clips.'
                  : 'Click "Render Clips" to start processing.'}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
