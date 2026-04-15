'use client';

import { motion } from 'framer-motion';
import { CheckSquare, Square, Edit2, Play } from 'lucide-react';
import { Moment } from '@/store/clipStore';
import { useClipStore } from '@/store/clipStore';
import { useRouter } from 'next/navigation';

interface Props {
  moment: Moment;
  index: number;
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
  return (
    <span className={`${cls} text-xs font-bold px-2 py-0.5 rounded-full tabular-nums`}>
      {score}
    </span>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SCENE_COLORS: Record<string, string> = {
  confrontation: 'text-red-400 bg-red-400/10',
  humor: 'text-yellow-400 bg-yellow-400/10',
  revelation: 'text-purple-400 bg-purple-400/10',
  action: 'text-orange-400 bg-orange-400/10',
  emotional: 'text-blue-400 bg-blue-400/10',
  romance: 'text-pink-400 bg-pink-400/10',
  suspense: 'text-violet-400 bg-violet-400/10',
  dialogue: 'text-green-400 bg-green-400/10',
};

export default function ClipCard({ moment, index }: Props) {
  const { toggleSelect, setActiveClipId } = useClipStore();
  const router = useRouter();

  const duration = (moment.trim_end ?? moment.end_time) - (moment.trim_start ?? moment.start_time);
  const sceneColor = SCENE_COLORS[moment.scene_type] || 'text-muted bg-muted/10';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`glass rounded-xl overflow-hidden transition-all
        ${moment.selected ? 'ring-1 ring-gold/50' : 'hover:ring-1 hover:ring-white/10'}`}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-surface shrink-0">
          {moment.thumbnail ? (
            <img
              src={moment.thumbnail}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play size={20} className="text-muted" />
            </div>
          )}
          <div className="absolute bottom-1 right-1 text-[10px] bg-black/70 px-1 rounded">
            {formatTime(duration)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <ScoreBadge score={moment.viral_score} />
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sceneColor}`}>
                {moment.scene_type}
              </span>
            </div>
            <span className="text-[11px] text-muted tabular-nums">
              {formatTime(moment.trim_start ?? moment.start_time)} – {formatTime(moment.trim_end ?? moment.end_time)}
            </span>
          </div>

          <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
            {moment.transcript || moment.reason}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => toggleSelect(moment.id)}
            className="text-muted hover:text-gold transition-colors"
          >
            {moment.selected ? (
              <CheckSquare size={18} className="text-gold" />
            ) : (
              <Square size={18} />
            )}
          </button>
          <button
            onClick={() => { setActiveClipId(moment.id); router.push('/text-editor'); }}
            className="text-muted hover:text-white transition-colors"
          >
            <Edit2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
