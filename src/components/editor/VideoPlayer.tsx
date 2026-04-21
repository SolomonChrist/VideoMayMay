/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { Zap } from 'lucide-react';

export const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { 
    videoUrl, 
    currentTime, 
    setCurrentTime, 
    isPlaying, 
    playbackRate,
    setPlaying,
    isReady,
    metadata,
    segments,
    skipSilence
  } = useEditorStore();

  // Handling silence skipping
  useEffect(() => {
    if (!skipSilence || !isPlaying || segments.length === 0) return;
    
    // Find if we are currently in an active segment
    // More aggressive lookahead for smoother hardware jumps
    const lookAhead = currentTime + 0.04;
    const currentSegment = segments.find(s => lookAhead >= s.start && lookAhead < s.end);
    
    // If we are NOT in a 'keep' segment (either in 'remove' or in a gap)
    if (!currentSegment || currentSegment.type === 'remove') {
      // Find the next 'keep' segment that starts after current time
      const nextKeep = segments.find(s => s.start > currentTime && s.type === 'keep');
      
      if (nextKeep) {
        const video = videoRef.current;
        if (video) {
          // Perform the jump
          video.currentTime = nextKeep.start;
          setCurrentTime(nextKeep.start);
          
          // Debug/Visual feedback could be added here if needed
          console.log('[AUTO-SKIP] Jumped to', nextKeep.start);
        }
      } else {
        // No more keep segments ahead
        const lastKeep = [...segments].reverse().find(s => s.type === 'keep');
        if (!lastKeep || currentTime >= lastKeep.end) {
           setPlaying(false);
        }
      }
    }
  }, [currentTime, skipSilence, isPlaying, segments]);

  // Sync state to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;

    if (isPlaying && video.paused) {
      video.play().catch(() => setPlaying(false));
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, isReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  // Handle manual seeks (from timeline or skip logic)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Only update video if it's significantly different to avoid jitter/feedback
    // and prioritize video's own clock while playing
    if (Math.abs(video.currentTime - currentTime) > 0.15) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const vTime = videoRef.current.currentTime;
      // Only update store while playing to drive the UI
      // Manual seeks already update the store via Timeline slider
      if (isPlaying && Math.abs(vTime - currentTime) > 0.01) {
        setCurrentTime(vTime);
      }
    }
  };

  const handleEnded = () => {
    setPlaying(false);
  };

  if (!videoUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white/40">
        <div className="text-center">
          <div className="text-4xl mb-4 text-white/20">🎬</div>
          <p>Drop a video to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-900 relative flex items-center justify-center p-8">
      <div className="w-full max-w-4xl relative aspect-video flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-w-full max-h-full shadow-2xl rounded-xl border border-slate-800"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          playsInline
        />
        
        {/* Speed indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="bg-slate-950/80 backdrop-blur px-4 py-1.5 rounded-full text-[10px] font-black border border-white/10 flex items-center gap-2 text-white uppercase tracking-widest z-10 shadow-2xl">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            {playbackRate}x Speed
          </div>
          {skipSilence && (
            <div className="bg-sky-500/20 backdrop-blur px-3 py-1 rounded-full text-[8px] font-black border border-sky-400/30 text-sky-400 uppercase tracking-[0.2em] z-10 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
               <Zap className="w-2.5 h-2.5 fill-sky-500" />
               Auto-Skip Active
            </div>
          )}
        </div>

        {/* Playback rate badge and Metadata */}
        <div className="absolute -bottom-16 left-0 right-0 flex flex-col items-center gap-4">
          <div className="bg-slate-800 border border-slate-700 px-3 py-1 rounded text-[10px] mono text-white/40 font-bold">
            {playbackRate.toFixed(2)}
          </div>
          
          <div className="w-full flex justify-between items-center text-[10px] mono text-white/30 uppercase font-black tracking-widest px-12">
            <div className="flex gap-8">
              <span>Resolution: {metadata?.width || '1080'}P</span>
              <span>Rate: 30 FPS</span>
            </div>
            <span>{metadata?.name || 'session_recording.mp4'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
