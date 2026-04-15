'use client';

import { useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Film, FolderOpen, Loader2 } from 'lucide-react';
import { useClipStore } from '@/store/clipStore';
import { useRouter } from 'next/navigation';
import { backendUrl, apiHeaders } from '@/lib/api';

const ACCEPTED = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];
const ACCEPTED_MIME = 'video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo,video/*';

export default function VideoDropzone() {
  const { setVideo } = useClipStore();
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('');
  const [pathLoading, setPathLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Upload file to backend ────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Use XMLHttpRequest so we can track upload progress
      const meta = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        // POST directly to backend — Next.js rewrites cap body size at 4MB
        xhr.open('POST', backendUrl('/api/video/upload'));
        const headers = apiHeaders();
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              reject(new Error(JSON.parse(xhr.responseText).detail || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));

        const form = new FormData();
        form.append('file', file);
        xhr.send(form);
      });

      setVideo(meta);
      router.push('/studio');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [setVideo, router]);

  // ── Load by path (for power users who paste a path) ──────────────────────
  const loadPath = useCallback(async (filePath: string) => {
    const trimmed = filePath.trim();
    if (!trimmed) return;
    setPathLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/video/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'File not found');
      }
      const data = await res.json();
      setVideo(data);
      router.push('/studio');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPathLoading(false);
    }
  }, [setVideo, router]);

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const busy = uploading || pathLoading;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">

      {/* ── Drop / click zone ── */}
      <motion.div
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300
          ${busy ? 'cursor-wait opacity-80' : 'cursor-pointer'}
          ${dragging ? 'border-gold bg-gold/5 animate-pulse-gold' : 'border-border hover:border-gold/50'}
          p-14 flex flex-col items-center justify-center gap-4 text-center`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !busy && inputRef.current?.click()}
        whileHover={busy ? {} : { scale: 1.01 }}
        whileTap={busy ? {} : { scale: 0.99 }}
      >
        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
              <Loader2 size={52} className="text-gold animate-spin" />
              <div className="w-48 space-y-1">
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gold rounded-full"
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-xs text-muted text-center">Uploading… {uploadProgress}%</p>
              </div>
            </motion.div>
          ) : dragging ? (
            <motion.div key="drop" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Film size={56} className="text-gold" />
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
              <Upload size={52} className="text-muted" />
              <div>
                <p className="text-xl font-semibold text-white">Drop your video here</p>
                <p className="text-sm text-muted mt-1">or <span className="text-gold underline underline-offset-2">click to browse</span> — MP4, MOV, MKV, AVI, WebM</p>
              </div>
              <div className="flex gap-2 text-xs text-muted">
                {ACCEPTED.map((ext) => (
                  <span key={ext} className="px-2 py-0.5 rounded bg-surface border border-border">{ext}</span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_MIME}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.target.value = '';
          }}
        />
      </motion.div>

      {/* ── Path input (optional, for large local files) ── */}
      <details className="group">
        <summary className="text-xs text-muted cursor-pointer select-none list-none flex items-center gap-1 px-1 hover:text-white transition-colors">
          <span className="group-open:rotate-90 transition-transform inline-block">›</span>
          Advanced: load by file path (skips upload, faster for large files)
        </summary>
        <div className="mt-2 flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2.5 focus-within:border-gold/50 transition-colors">
            <FolderOpen size={15} className="text-muted shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent text-sm text-white placeholder-muted outline-none"
              placeholder="/Users/you/Movies/film.mp4"
              value={pathInput}
              onChange={(e) => { setPathInput(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && loadPath(pathInput)}
            />
          </div>
          <button
            onClick={() => loadPath(pathInput)}
            disabled={!pathInput || busy}
            className="px-4 py-2 rounded-lg bg-gold text-black font-semibold text-sm disabled:opacity-40 hover:bg-gold-dim transition-colors"
          >
            {pathLoading ? 'Loading…' : 'Load'}
          </button>
        </div>
      </details>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-2"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
