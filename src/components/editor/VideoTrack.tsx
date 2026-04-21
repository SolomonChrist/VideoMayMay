/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';

interface VideoTrackProps {
  zoomLevel: number;
  duration: number;
}

export const VideoTrack: React.FC<VideoTrackProps> = ({ zoomLevel, duration }) => {
  const { videoUrl } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  
  // We want a thumbnail roughly every 150px on screen
  const secondsPerThumbnail = Math.max(1, Math.floor(150 / zoomLevel));
  const numThumbnails = Math.ceil(duration / secondsPerThumbnail);

  useEffect(() => {
    if (!videoUrl || numThumbnails <= 0) return;

    // To prevent heavy CPU load, we only extract a subset of frames
    // In a production app, we'd use a background worker or a more efficient scrubbing technique
    const extractFrames = async () => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      
      await new Promise(r => video.onloadeddata = r);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const thumbs: string[] = [];
      const step = secondsPerThumbnail;
      
      // Limit total thumbnails to prevent crash on long videos
      // 20 is a safe limit for browser memory during rapid extraction
      const limit = 20; 
      const effectiveStep = Math.max(step, duration / limit);
      
      for (let t = 0; t < duration; t += effectiveStep) {
        video.currentTime = t;
        await new Promise(r => video.onseeked = r);
        
        canvas.width = 160;
        canvas.height = 90;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbs.push(canvas.toDataURL('image/jpeg', 0.5));
        
        if (thumbs.length >= limit) break;
      }
      
      setThumbnails(thumbs);
    };

    extractFrames();
  }, [videoUrl]);

  return (
    <div className="absolute inset-0 flex pointer-events-none opacity-20 overflow-hidden mix-blend-overlay">
      {thumbnails.map((src, i) => (
        <div 
           key={i} 
           className="h-full flex-shrink-0"
           style={{ width: `${(duration / thumbnails.length) * zoomLevel}px` }}
        >
          <img src={src} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
      ))}
    </div>
  );
};
