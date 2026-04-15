'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';

const STEPS = [
  { label: 'Upload', path: '/' },
  { label: 'Analyze', path: '/studio' },
  { label: 'Customize', path: '/studio' },
  { label: 'Text', path: '/text-editor' },
  { label: 'Export', path: '/export' },
];

export default function StepNav() {
  const pathname = usePathname();

  const activeIndex = STEPS.findLastIndex((s) => pathname.startsWith(s.path) && s.path !== '/') ||
    (pathname === '/' ? 0 : -1);

  return (
    <nav className="w-full border-b border-border bg-surface/50 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-0">
        {STEPS.map((step, i) => {
          const isActive = i === activeIndex;
          const isDone = i < activeIndex;

          return (
            <div key={step.label} className="flex items-center">
              <Link
                href={step.path}
                className={`flex items-center gap-1.5 px-4 h-12 text-sm font-medium border-b-2 transition-colors
                  ${isActive ? 'text-gold border-gold' : isDone ? 'text-success border-transparent' : 'text-muted border-transparent hover:text-white'}`}
              >
                {isDone ? <Check size={12} /> : <span className="text-xs opacity-60">{i + 1}</span>}
                {step.label}
              </Link>
              {i < STEPS.length - 1 && (
                <span className="text-border px-1 text-xs">›</span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
