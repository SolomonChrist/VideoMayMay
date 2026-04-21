/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { cn, formatTime } from '../../lib/utils';
import { Segment } from '../../types';
import { Scissors } from 'lucide-react';

import { WaveformCanvas } from './WaveformCanvas';
import { VideoTrack } from './VideoTrack';

export const Timeline: React.FC = () => {
  const { 
    segments, 
    currentTime, 
    duration, 
    zoomLevel, 
    setZoomLevel,
    setCurrentTime,
    setPlaying,
    selectedSegmentIds,
    setSelectedSegments,
    toggleSegmentType,
    isPlaying,
    splitSegmentAt
  } = useEditorStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const totalWidth = duration * zoomLevel;
  
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
    const time = x / zoomLevel;
    setCurrentTime(Math.min(duration, Math.max(0, time)));
  };

  const handleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedSegments([...selectedSegmentIds, id]);
    } else {
      setSelectedSegments([id]);
    }
  };

  // Sync scroll with playhead if it goes out of view
  useEffect(() => {
    if (!scrollRef.current) return;
    const playheadX = currentTime * zoomLevel;
    const containerWidth = scrollRef.current.clientWidth;
    const scrollLeft = scrollRef.current.scrollLeft;
    
    if (playheadX < scrollLeft || playheadX > scrollLeft + containerWidth) {
      scrollRef.current.scrollTo({
        left: playheadX - containerWidth / 2,
        behavior: 'smooth'
      });
    }
  }, [currentTime, zoomLevel]);

  return (
    <div className="relative flex flex-col select-none overflow-hidden p-6 bg-slate-950 border-t border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          <div className="text-xl mono font-bold text-sky-400">
            {formatTime(currentTime)}:<span className="text-sky-700 text-sm">33</span> 
          </div>
          <div className="flex gap-2">
             <button 
              onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
              className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-all active:scale-95"
             >
                <span className="text-[10px]">⏮</span>
             </button>
             <button 
              onClick={() => setPlaying(!isPlaying)}
              className="w-10 h-10 rounded bg-sky-500 flex items-center justify-center text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.4)] active:scale-95 transition-all text-xs"
             >
                {isPlaying ? '⏸' : '▶'}
             </button>
             <button 
              onClick={() => setCurrentTime(Math.min(duration, currentTime + 5))}
              className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-all active:scale-95"
             >
                <span className="text-[10px]">⏭</span>
             </button>

             <div className="w-px h-6 bg-slate-800 mx-2 self-center" />

             <button 
              onClick={() => splitSegmentAt(currentTime)}
              className="h-10 px-4 rounded bg-slate-800 border border-slate-700 text-sky-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2"
             >
                <Scissors className="w-4 h-4" />
                Split (S)
             </button>
          </div>
        </div>

        <div className="flex gap-8 items-center">
          <div className="text-right">
             <span className="sidebar-label mb-0">Playback Status</span>
             <div className="text-[11px] text-slate-500 mono uppercase font-bold tracking-tighter">
                {segments.filter(s => s.type === 'keep').length} Keep / {segments.filter(s => s.type === 'remove').length} Silence
             </div>
          </div>
          <div className="flex items-center gap-3">
             <span className="sidebar-label mb-0">Zoom</span>
             <div className="flex bg-slate-800 rounded border border-slate-700 p-0.5">
                <button onClick={() => setZoomLevel(zoomLevel / 1.2)} className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-slate-700">-</button>
                <button onClick={() => setZoomLevel(zoomLevel * 1.2)} className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-slate-700">+</button>
             </div>
          </div>
        </div>
      </div>

      {/* Main Timeline Area */}
      <div 
        ref={scrollRef}
        className="h-64 overflow-x-auto overflow-y-hidden custom-scrollbar relative bg-slate-900 border border-slate-800 rounded shadow-inner"
        onMouseDown={handleTimelineClick}
      >
        <div 
          className="relative h-full"
          style={{ width: totalWidth }}
        >
          {/* Video Strip Background */}
          <VideoTrack duration={duration} zoomLevel={zoomLevel} />

          {/* Waveform Visualization */}
          <div className="absolute inset-0 pointer-events-none opacity-80 mix-blend-screen">
            <WaveformCanvas zoomLevel={zoomLevel} duration={duration} />
          </div>

          {/* Segments Layer */}
          <div className="absolute inset-0 flex">
            {segments.map((segment, idx) => (
              <div
                key={segment.id}
                onClick={(e) => handleSelection(segment.id, e)}
                onDoubleClick={() => toggleSegmentType([segment.id])}
                className={cn(
                  "absolute top-0 bottom-0 border-r border-slate-800/40 transition-colors cursor-pointer group/seg overflow-hidden",
                  segment.type === 'keep' ? "bg-sky-500/10 border-l border-sky-500/20" : "bg-rose-500/30 backdrop-blur-[2px]",
                  selectedSegmentIds.includes(segment.id) && "ring-2 ring-inset ring-sky-400 z-10 bg-sky-500/20",
                  segment.manual && "border-t-4 border-amber-500/60"
                )}
                style={{
                  left: segment.start * zoomLevel,
                  width: (segment.end - segment.start) * zoomLevel
                }}
              >
                <div className="absolute top-2 left-2 text-[10px] font-black text-white/40 uppercase tracking-widest opacity-0 group-hover:opacity-100">
                   {segment.type === 'keep' ? `KEEP ${idx + 1}` : 'SILENCE (CUT)'}
                </div>
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-[2px] bg-amber-400 z-30 pointer-events-none shadow-[0_0_15px_rgba(251,191,36,0.6)]"
            style={{ left: currentTime * zoomLevel }}
          />
        </div>
      </div>
    </div>
  );
};
