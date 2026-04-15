'use client';

import { useWebSocket } from './useWebSocket';

export function useJobStatus(jobId: string | null) {
  const { events, lastEvent, done, error } = useWebSocket(jobId);

  const progress = lastEvent?.pct ?? 0;
  const stage = lastEvent?.stage ?? '';
  const message = lastEvent?.message ?? '';
  const result = done && lastEvent?.data && !lastEvent.data.clip ? lastEvent.data : null;

  // Clips streamed in one-by-one via clip_ready events
  const streamingClips = events
    .filter((e) => e.stage === 'clip_ready' && e.data?.clip)
    .map((e) => e.data.clip);

  const stageChecklist = [
    { key: 'init', label: 'Reading Metadata' },
    { key: 'processing', label: 'Analyzing Segments' },
    { key: 'clip_ready', label: 'Clips Ready' },
    { key: 'done', label: 'Complete' },
  ];

  const completedStages = new Set(events.map((e) => e.stage));

  return {
    progress,
    stage,
    message,
    done,
    error,
    result,
    streamingClips,
    stageChecklist,
    completedStages,
  };
}
