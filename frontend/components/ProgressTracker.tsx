'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle } from 'lucide-react';

interface StageItem {
  key: string;
  label: string;
}

interface Props {
  progress: number;
  stage: string;
  message: string;
  done: boolean;
  error: string | null;
  stageChecklist: StageItem[];
  completedStages: Set<string>;
}

export default function ProgressTracker({
  progress, stage, message, done, error, stageChecklist, completedStages,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">{message || 'Processing...'}</span>
          <span className="text-gold font-mono">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gold rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Stage checklist */}
      <div className="grid grid-cols-2 gap-2">
        {stageChecklist.map((s) => {
          const isComplete = completedStages.has(s.key) || (done && s.key === 'done');
          const isActive = stage === s.key && !isComplete;
          const isError = error && stage === s.key;

          return (
            <div
              key={s.key}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors
                ${isComplete ? 'text-success bg-success/5' : isActive ? 'text-white bg-gold/5' : 'text-muted'}`}
            >
              <span className="shrink-0">
                {isError ? (
                  <AlertCircle size={14} className="text-danger" />
                ) : isComplete ? (
                  <Check size={14} />
                ) : isActive ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-current inline-block" />
                )}
              </span>
              {s.label}
            </div>
          );
        })}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3"
        >
          <strong>Error:</strong> {error}
        </motion.div>
      )}
    </div>
  );
}
