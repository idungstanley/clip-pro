'use client';

import { motion } from 'framer-motion';
import { Film, Zap, Lock, Cpu } from 'lucide-react';
import VideoDropzone from '@/components/VideoDropzone';

const FEATURES = [
  { icon: Zap, label: 'AI Viral Detection', desc: 'Whisper + LLaMA 3 + OpenCV' },
  { icon: Cpu, label: 'Runs 100% Locally', desc: 'No cloud, no API keys' },
  { icon: Lock, label: 'Fully Private', desc: 'Files never leave your machine' },
  { icon: Film, label: '4K Upscaling', desc: 'Real-ESRGAN, free forever' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Film size={24} className="text-gold" />
        <span className="font-display text-xl tracking-wide text-white">ViralClip AI</span>
        <span className="text-xs text-muted ml-2 border border-border rounded px-2 py-0.5">
          100% Free • Local
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 space-y-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 max-w-2xl"
        >
          <h1 className="text-5xl font-display tracking-wide text-white">
            Find Viral Moments
            <br />
            <span className="text-gold">in Any Movie</span>
          </h1>
          <p className="text-muted text-lg">
            Drop in a video. AI detects the best clips. You customize and export.
            <br />
            No internet. No API keys. No subscriptions. Forever free.
          </p>
        </motion.div>

        {/* Dropzone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="w-full max-w-2xl"
        >
          <VideoDropzone />
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl"
        >
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="glass rounded-xl p-4 space-y-1">
              <Icon size={18} className="text-gold" />
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-muted">{desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Stack badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-2 text-xs text-muted"
        >
          {['Whisper large-v3', 'LLaMA 3', 'PySceneDetect', 'librosa', 'OpenCV', 'DeepFace', 'Real-ESRGAN', 'FFmpeg'].map((t) => (
            <span key={t} className="px-2 py-0.5 border border-border rounded">{t}</span>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
