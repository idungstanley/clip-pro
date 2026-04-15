'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { TextLayer, Moment } from '@/store/clipStore';
import { useClipStore } from '@/store/clipStore';

const FONTS = [
  'Bebas Neue', 'Montserrat', 'Oswald', 'Anton', 'Raleway', 'Cinzel',
  'Teko', 'Barlow Condensed', 'Russo One', 'Righteous', 'Arial',
];

const ANIMATIONS = ['none', 'fade-in', 'slide-up', 'slide-left', 'typewriter', 'pop-scale'];

interface Props {
  moment: Moment;
  thumbnailUrl: string | null;
}

export default function TextCanvas({ moment, thumbnailUrl }: Props) {
  const { updateMoment } = useClipStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const [layers, setLayers] = useState<TextLayer[]>(moment.text_layers ?? []);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [fabricLoaded, setFabricLoaded] = useState(false);

  const canvasW = 640;
  const canvasH = 360;

  // Sync layers to store
  useEffect(() => {
    updateMoment(moment.id, { text_layers: layers });
  }, [layers]);

  // Load Fabric.js
  useEffect(() => {
    import('fabric').then(({ fabric }) => {
      if (!canvasRef.current || fabricRef.current) return;

      const canvas = new fabric.Canvas(canvasRef.current, {
        width: canvasW,
        height: canvasH,
        backgroundColor: '#000',
        selection: true,
      });

      fabricRef.current = canvas;

      // Load background frame
      if (thumbnailUrl) {
        fabric.Image.fromURL(thumbnailUrl, (img: any) => {
          img.scaleToWidth(canvasW);
          img.scaleToHeight(canvasH);
          img.set({ selectable: false, evented: false, opacity: 0.6 });
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
        });
      }

      canvas.on('object:modified', syncFromCanvas);
      canvas.on('selection:created', (e: any) => {
        const obj = e.selected?.[0];
        if (obj?.layerId) setActiveLayer(obj.layerId);
      });
      canvas.on('selection:cleared', () => setActiveLayer(null));

      setFabricLoaded(true);
    });

    return () => {
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [thumbnailUrl]);

  // Rebuild canvas objects when layers change externally
  useEffect(() => {
    if (!fabricRef.current || !fabricLoaded) return;
    const canvas = fabricRef.current;
    // Remove all text objects
    const toRemove = canvas.getObjects().filter((o: any) => o.type === 'text' || o.type === 'i-text');
    toRemove.forEach((o: any) => canvas.remove(o));

    layers.forEach((layer) => {
      addFabricText(canvas, layer);
    });
    canvas.renderAll();
  }, [fabricLoaded, layers.length]);

  const addFabricText = (canvas: any, layer: TextLayer) => {
    import('fabric').then(({ fabric }) => {
      const text = new fabric.IText(layer.text || 'Text', {
        left: (layer.x_pct / 100) * canvasW,
        top: (layer.y_pct / 100) * canvasH,
        fontFamily: layer.font,
        fontSize: layer.size,
        fill: layer.color,
        stroke: layer.stroke_color,
        strokeWidth: layer.stroke_width,
        opacity: layer.alpha,
        layerId: layer.id,
      } as any);

      text.on('modified', () => syncFromCanvas());
      canvas.add(text);
    });
  };

  const syncFromCanvas = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    setLayers((prev) =>
      prev.map((layer) => {
        const obj = canvas.getObjects().find((o: any) => o.layerId === layer.id);
        if (!obj) return layer;
        return {
          ...layer,
          x_pct: Math.round((obj.left / canvasW) * 100),
          y_pct: Math.round((obj.top / canvasH) * 100),
          text: obj.text ?? layer.text,
        };
      })
    );
  };

  const addLayer = () => {
    const newLayer: TextLayer = {
      id: uuidv4(),
      text: 'Add your text',
      x_pct: 50,
      y_pct: 80,
      font: 'Montserrat',
      size: 48,
      color: '#ffffff',
      alpha: 1.0,
      stroke_color: '#000000',
      stroke_width: 2,
      animation: 'none',
      start_sec: 0,
      end_sec: 9999,
    };
    setLayers((prev) => [...prev, newLayer]);
    if (fabricRef.current) {
      addFabricText(fabricRef.current, newLayer);
      fabricRef.current.renderAll();
    }
    setActiveLayer(newLayer.id);
  };

  const removeLayer = (id: string) => {
    if (fabricRef.current) {
      const obj = fabricRef.current.getObjects().find((o: any) => o.layerId === id);
      if (obj) fabricRef.current.remove(obj);
      fabricRef.current.renderAll();
    }
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (activeLayer === id) setActiveLayer(null);
  };

  const updateLayer = (id: string, patch: Partial<TextLayer>) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    if (fabricRef.current) {
      const obj = fabricRef.current.getObjects().find((o: any) => o.layerId === id);
      if (obj) {
        if (patch.text !== undefined) obj.set('text', patch.text);
        if (patch.font !== undefined) obj.set('fontFamily', patch.font);
        if (patch.size !== undefined) obj.set('fontSize', patch.size);
        if (patch.color !== undefined) obj.set('fill', patch.color);
        if (patch.stroke_color !== undefined) obj.set('stroke', patch.stroke_color);
        if (patch.stroke_width !== undefined) obj.set('strokeWidth', patch.stroke_width);
        if (patch.alpha !== undefined) obj.set('opacity', patch.alpha);
        fabricRef.current.renderAll();
      }
    }
  };

  const active = layers.find((l) => l.id === activeLayer);

  return (
    <div className="flex gap-6">
      {/* Canvas */}
      <div className="shrink-0">
        <canvas ref={canvasRef} className="rounded-lg border border-border" />
        <p className="text-xs text-muted mt-2 text-center">
          Click text to select, drag to reposition
        </p>
      </div>

      {/* Layer panel */}
      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Text Layers</h3>
          <button
            onClick={addLayer}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gold text-black rounded-lg font-semibold hover:bg-gold-dim transition-colors"
          >
            <Plus size={12} /> Add Layer
          </button>
        </div>

        {/* Layer list */}
        <div className="space-y-1.5">
          {layers.map((layer) => (
            <div
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors
                ${activeLayer === layer.id ? 'bg-gold/10 border border-gold/30' : 'bg-surface border border-border hover:border-white/20'}`}
            >
              <span className="text-sm text-white truncate flex-1">{layer.text}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                className="text-muted hover:text-danger transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {layers.length === 0 && (
            <p className="text-sm text-muted text-center py-6">
              No text layers. Click "Add Layer" to start.
            </p>
          )}
        </div>

        {/* Active layer controls */}
        {active && (
          <div className="space-y-3 border-t border-border pt-3">
            <div>
              <label className="label-sm">Text</label>
              <input
                type="text"
                value={active.text}
                onChange={(e) => updateLayer(active.id, { text: e.target.value })}
                className="input-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-sm">Font</label>
                <select
                  value={active.font}
                  onChange={(e) => updateLayer(active.id, { font: e.target.value })}
                  className="input-sm"
                >
                  {FONTS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="label-sm">Size ({active.size}px)</label>
                <input
                  type="range" min={12} max={200} value={active.size}
                  onChange={(e) => updateLayer(active.id, { size: +e.target.value })}
                  className="w-full accent-gold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-sm">Color</label>
                <input
                  type="color" value={active.color}
                  onChange={(e) => updateLayer(active.id, { color: e.target.value })}
                  className="w-full h-8 rounded cursor-pointer bg-transparent border border-border"
                />
              </div>
              <div>
                <label className="label-sm">Opacity ({Math.round(active.alpha * 100)}%)</label>
                <input
                  type="range" min={0} max={1} step={0.05} value={active.alpha}
                  onChange={(e) => updateLayer(active.id, { alpha: +e.target.value })}
                  className="w-full accent-gold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-sm">Stroke Color</label>
                <input
                  type="color" value={active.stroke_color}
                  onChange={(e) => updateLayer(active.id, { stroke_color: e.target.value })}
                  className="w-full h-8 rounded cursor-pointer bg-transparent border border-border"
                />
              </div>
              <div>
                <label className="label-sm">Stroke Width ({active.stroke_width}px)</label>
                <input
                  type="range" min={0} max={20} value={active.stroke_width}
                  onChange={(e) => updateLayer(active.id, { stroke_width: +e.target.value })}
                  className="w-full accent-gold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-sm">Animation</label>
                <select
                  value={active.animation}
                  onChange={(e) => updateLayer(active.id, { animation: e.target.value })}
                  className="input-sm"
                >
                  {ANIMATIONS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-sm">Start (s)</label>
                <input
                  type="number" min={0} step={0.1} value={active.start_sec}
                  onChange={(e) => updateLayer(active.id, { start_sec: +e.target.value })}
                  className="input-sm"
                />
              </div>
              <div>
                <label className="label-sm">End (s)</label>
                <input
                  type="number" min={0} step={0.1} value={active.end_sec}
                  onChange={(e) => updateLayer(active.id, { end_sec: +e.target.value })}
                  className="input-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .label-sm { display: block; font-size: 11px; color: #888; margin-bottom: 4px; }
        .input-sm {
          width: 100%;
          background: #111;
          border: 1px solid #1f1f1f;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 13px;
          color: white;
          outline: none;
        }
        .input-sm:focus { border-color: #F5C518; }
      `}</style>
    </div>
  );
}
