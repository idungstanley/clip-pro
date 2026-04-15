'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StepNav from '@/components/StepNav';
import TextCanvas from '@/components/TextCanvas';
import { useClipStore } from '@/store/clipStore';
import { backendUrl, withKey } from '@/lib/api';

export default function TextEditorPage() {
  const { video, moments, activeClipId, setActiveClipId } = useClipStore();
  const router = useRouter();

  useEffect(() => {
    if (!video) router.replace('/');
  }, [video, router]);

  const selectedMoments = moments.filter((m) => m.selected);
  const activeMoment = moments.find((m) => m.id === activeClipId) ?? selectedMoments[0] ?? moments[0];
  const activeIndex = selectedMoments.findIndex((m) => m.id === activeMoment?.id);

  const goPrev = () => {
    if (activeIndex > 0) setActiveClipId(selectedMoments[activeIndex - 1].id);
  };
  const goNext = () => {
    if (activeIndex < selectedMoments.length - 1) setActiveClipId(selectedMoments[activeIndex + 1].id);
  };

  if (!video || !activeMoment) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <StepNav />

      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-border px-5 py-3 flex items-center justify-between bg-surface/30">
          <button
            onClick={() => router.push('/studio')}
            className="flex items-center gap-1 text-sm text-muted hover:text-white transition-colors"
          >
            <ChevronLeft size={16} /> Back to Studio
          </button>

          {/* Clip navigation */}
          {selectedMoments.length > 1 && (
            <div className="flex items-center gap-3">
              <button onClick={goPrev} disabled={activeIndex <= 0} className="p-1 rounded hover:bg-surface disabled:opacity-30">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-muted">
                Clip <span className="text-white font-medium">{activeIndex + 1}</span> of {selectedMoments.length}
              </span>
              <button onClick={goNext} disabled={activeIndex >= selectedMoments.length - 1} className="p-1 rounded hover:bg-surface disabled:opacity-30">
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          <button
            onClick={() => router.push('/export')}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gold text-black text-sm font-semibold rounded-lg hover:bg-gold-dim transition-colors"
          >
            Export <ChevronRight size={14} />
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">Text Overlay Editor</h2>
              <p className="text-xs text-muted mt-0.5">
                Clip: <span className="text-gold">{activeMoment.scene_type}</span> ·{' '}
                Score: <span className="text-gold">{activeMoment.viral_score}</span> ·{' '}
                Duration:{' '}
                {((activeMoment.trim_end ?? activeMoment.end_time) - (activeMoment.trim_start ?? activeMoment.start_time)).toFixed(1)}s
              </p>
            </div>

            <TextCanvas
              moment={activeMoment}
              thumbnailUrl={activeMoment.thumbnail
                ? withKey(backendUrl(activeMoment.thumbnail))
                : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
