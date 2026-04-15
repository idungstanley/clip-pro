'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight, RotateCcw, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import StepNav from '@/components/StepNav';
import ClipCard from '@/components/ClipCard';
import ProgressTracker from '@/components/ProgressTracker';
import WaveformEditor from '@/components/WaveformEditor';
import FormatSelector from '@/components/FormatSelector';
import { useClipStore } from '@/store/clipStore';
import { useJobStatus } from '@/hooks/useJobStatus';
import { backendUrl, withKey } from '@/lib/api';

type Tab = 'clips' | 'settings';

export default function StudioPage() {
  const {
    video, moments, setMoments, setAnalysisJobId, analysisJobId,
    selectTopN, exportSettings, activeClipId, setActiveClipId,
  } = useClipStore();
  const router = useRouter();

  const [analyzing, setAnalyzing] = useState(false);
  const [tab, setTab] = useState<Tab>('clips');
  const [autoN, setAutoN] = useState(5);
  const [clipDuration, setClipDuration] = useState(59);
  const [pollProgress, setPollProgress] = useState(0);
  const [pollMessage, setPollMessage] = useState('');
  const [pollStage, setPollStage] = useState('');
  const [pollError, setPollError] = useState<string | null>(null);

  const seenClipIds = useRef<Set<string>>(new Set());

  const {
    progress: wsProgress, stage: wsStage, message: wsMessage,
    done, error: wsError, result, streamingClips, stageChecklist, completedStages,
  } = useJobStatus(analyzing ? analysisJobId : null);

  const progress = Math.max(wsProgress, pollProgress);
  const stage    = wsStage    || pollStage;
  const message  = wsMessage  || pollMessage;
  const error    = wsError    || pollError;

  // Redirect if no video
  useEffect(() => {
    if (!video) router.replace('/');
  }, [video, router]);

  // Add clips as they stream in (one by one)
  useEffect(() => {
    if (!analyzing || streamingClips.length === 0) return;

    const newClips = streamingClips.filter((c) => !seenClipIds.current.has(c.id));
    if (newClips.length === 0) return;

    newClips.forEach((c) => seenClipIds.current.add(c.id));

    setMoments([...moments, ...newClips]);

    // Auto-select the first clip that arrives
    if (!activeClipId && newClips.length > 0) {
      setActiveClipId(newClips[0].id);
    }
  }, [streamingClips.length]);

  // When fully done, use final sorted result
  useEffect(() => {
    if (done && result) {
      const m = result.moments || result;
      setMoments(Array.isArray(m) ? m : []);
      setAnalyzing(false);
      selectTopN(exportSettings.clip_count);
    }
  }, [done, result]);

  // Start analysis
  const runAnalysis = useCallback(async () => {
    if (!video) return;
    setAnalyzing(true);
    setMoments([]);
    seenClipIds.current.clear();
    setPollProgress(0); setPollMessage(''); setPollStage(''); setPollError(null);

    const res = await fetch('/api/analyze/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_path: video.path,
        clip_duration: clipDuration,
        max_clips: 20,
      }),
    });
    const data = await res.json();
    setAnalysisJobId(data.job_id);

    if (data.cached && data.result) {
      setMoments(data.result.moments || data.result);
      setAnalyzing(false);
    }
  }, [video, clipDuration, setAnalysisJobId, setMoments]);

  // Polling fallback
  useEffect(() => {
    if (!analyzing || !analysisJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/analyze/status/${analysisJobId}`);
        const data = await res.json();
        if (!data.found) return;

        setPollProgress(data.progress ?? 0);
        setPollMessage(data.status ?? '');
        setPollStage(data.status ?? '');

        if (data.error) {
          setPollError(data.error);
          setAnalyzing(false);
          clearInterval(interval);
          return;
        }

        if (data.done && data.result) {
          const m = data.result.moments || data.result;
          setMoments(Array.isArray(m) ? m : []);
          setAnalyzing(false);
          selectTopN(exportSettings.clip_count);
          clearInterval(interval);
        }
      } catch {}
    }, 1500);

    return () => clearInterval(interval);
  }, [analyzing, analysisJobId]);

  // Auto-analyze on page load
  useEffect(() => {
    if (video && moments.length === 0 && !analyzing) {
      runAnalysis();
    }
  }, [video]);

  const selectedMoments = moments.filter((m) => m.selected);
  const activeMoment = moments.find((m) => m.id === activeClipId) ?? moments[0];

  if (!video) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <StepNav />

      <div className="flex-1 flex">
        {/* Left: Clip list */}
        <aside className="w-80 border-r border-border flex flex-col">
          {/* Video info bar */}
          <div className="p-4 border-b border-border bg-surface/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{video.filename}</p>
                <p className="text-xs text-muted">
                  {Math.floor(video.duration / 60)}m {Math.floor(video.duration % 60)}s ·{' '}
                  {video.width}×{video.height} · {video.size_mb}MB
                </p>
              </div>

              {/* Clip duration control */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Clock size={12} className="text-muted" />
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={clipDuration}
                  onChange={(e) => setClipDuration(Math.max(10, +e.target.value))}
                  disabled={analyzing}
                  title="Clip duration (seconds)"
                  className="w-14 bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-white text-center disabled:opacity-40"
                />
                <span className="text-xs text-muted">s</span>
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="p-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors disabled:opacity-40"
                  title="Re-analyze"
                >
                  <RotateCcw size={14} className={analyzing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['clips', 'settings'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors
                  ${tab === t ? 'text-gold border-b-2 border-gold' : 'text-muted hover:text-white'}`}
              >
                {t === 'clips' ? `Clips (${moments.length})` : 'Export Settings'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tab === 'clips' ? (
              <>
                {/* Auto-select bar */}
                {moments.length > 0 && (
                  <div className="flex items-center gap-2 pb-1">
                    <span className="text-xs text-muted">Auto-select top</span>
                    <input
                      type="number" min={1} max={moments.length} value={autoN}
                      onChange={(e) => setAutoN(+e.target.value)}
                      className="w-12 bg-surface border border-border rounded px-2 py-0.5 text-xs text-white text-center"
                    />
                    <button onClick={() => selectTopN(autoN)} className="text-xs text-gold hover:underline">
                      Select
                    </button>
                    <span className="ml-auto text-xs text-muted">{selectedMoments.length} selected</span>
                  </div>
                )}

                {/* Analysis progress */}
                {analyzing && (
                  <div className="py-2">
                    <ProgressTracker
                      progress={progress}
                      stage={stage}
                      message={message}
                      done={done}
                      error={error}
                      stageChecklist={stageChecklist}
                      completedStages={completedStages}
                    />
                  </div>
                )}

                {/* Clip cards */}
                <AnimatePresence>
                  {moments.map((m, i) => (
                    <div key={m.id} onClick={() => setActiveClipId(m.id)}>
                      <ClipCard moment={m} index={i} />
                    </div>
                  ))}
                </AnimatePresence>

                {!analyzing && moments.length === 0 && (
                  <div className="text-center py-12 text-muted text-sm">
                    <Sparkles className="mx-auto mb-3 text-gold/40" size={32} />
                    No clips yet. Analysis will start automatically.
                  </div>
                )}
              </>
            ) : (
              <FormatSelector />
            )}
          </div>
        </aside>

        {/* Right: Clip editor */}
        <main className="flex-1 flex flex-col">
          {activeMoment ? (
            <>
              <div className="relative bg-black aspect-video max-h-[55vh] w-full">
                <video
                  key={activeMoment.id}
                  src={withKey(backendUrl(`/api/video/stream?path=${encodeURIComponent(video.path)}#t=${activeMoment.trim_start ?? activeMoment.start_time},${activeMoment.trim_end ?? activeMoment.end_time}`))}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold
                        ${activeMoment.viral_score >= 80 ? 'score-high' : activeMoment.viral_score >= 60 ? 'score-mid' : 'score-low'}`}>
                        {activeMoment.viral_score}
                      </span>
                      <span className="text-sm text-muted capitalize">{activeMoment.scene_type}</span>
                    </div>
                    <p className="text-xs text-muted mt-1 italic">"{activeMoment.reason}"</p>
                  </div>
                  <button
                    onClick={() => router.push('/text-editor')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-black text-sm font-semibold rounded-lg hover:bg-gold-dim transition-colors"
                  >
                    Add Text <ChevronRight size={14} />
                  </button>
                </div>

                {activeMoment.transcript && (
                  <div className="glass rounded-lg p-3">
                    <p className="text-xs text-muted mb-1">Transcript</p>
                    <p className="text-sm text-white/80 leading-relaxed">"{activeMoment.transcript}"</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted mb-2 uppercase tracking-wide">Trim Timeline</p>
                  <WaveformEditor moment={activeMoment} videoPath={video.path} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Audio Energy', value: activeMoment.audio_energy },
                    { label: 'Motion', value: activeMoment.motion_score },
                    { label: 'Face Intensity', value: activeMoment.face_intensity },
                  ].map(({ label, value }) => (
                    <div key={label} className="glass rounded-lg p-3 text-center">
                      <p className="text-xs text-muted">{label}</p>
                      <p className="text-lg font-bold text-gold">{Math.round(value * 100)}</p>
                      <div className="w-full h-1 bg-border rounded-full mt-1">
                        <div className="h-1 bg-gold rounded-full" style={{ width: `${value * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">
              {analyzing ? (
                <div className="text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Analyzing — first clip arriving soon...</p>
                </div>
              ) : (
                'Select a clip to edit'
              )}
            </div>
          )}

          <div className="border-t border-border p-4 flex items-center justify-between bg-surface/30">
            <p className="text-sm text-muted">
              <span className="text-white font-medium">{selectedMoments.length}</span> clips selected
            </p>
            <button
              onClick={() => router.push('/export')}
              disabled={selectedMoments.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-gold text-black font-semibold rounded-lg hover:bg-gold-dim transition-colors disabled:opacity-40 text-sm"
            >
              Export Clips <ChevronRight size={16} />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
