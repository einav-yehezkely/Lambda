'use client';

import { useState } from 'react';
import { LatexContent } from './latex-content';

interface FlashCardProps {
  front: string;
  back: string;
  onFirstFlip?: () => void;
}

export function FlashCard({ front, back, onFirstFlip }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => {
    if (!flipped) onFirstFlip?.();
    setFlipped((f) => !f);
  };

  return (
    <div className="select-none w-full" style={{ perspective: '1000px' }}>
      <div
        className="cursor-pointer"
        onClick={handleFlip}
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          display: 'grid',
        }}
      >
        {/* Front */}
        <div
          className="flex flex-col items-center justify-center p-6 min-h-36 rounded-xl border-2 border-slate-200 bg-white"
          style={{ backfaceVisibility: 'hidden', gridArea: '1/1' }}
        >
          <div className="text-center text-slate-800 text-sm leading-relaxed" dir="auto">
            <LatexContent content={front} />
          </div>
        </div>
        {/* Back */}
        <div
          className="flex flex-col items-center justify-center p-6 min-h-36 rounded-xl border-2 border-blue-200 bg-blue-50"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', gridArea: '1/1' }}
        >
          <div className="text-center text-slate-800 text-sm leading-relaxed" dir="auto">
            <LatexContent content={back} />
          </div>
        </div>
      </div>
      <p className="text-xs text-center text-slate-400 mt-2">
        {flipped ? 'Click to flip back' : 'Click to reveal'}
      </p>
    </div>
  );
}
