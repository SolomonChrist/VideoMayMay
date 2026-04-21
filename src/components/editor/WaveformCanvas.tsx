/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { getAudioBuffer } from '../../utils/audioAnalysis';

interface WaveformCanvasProps {
  zoomLevel: number;
  duration: number;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({ zoomLevel, duration }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { audioBuffer } = useEditorStore();
  const [loudnessData, setLoudnessData] = useState<Float32Array | null>(null);

  useEffect(() => {
    if (!audioBuffer) return;
    
    // We already have the buffer, no need to call getAudioBuffer again!
    // Extract channel data and maybe downsample for rendering if needed
    setLoudnessData(audioBuffer.getChannelData(0));
  }, [audioBuffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loudnessData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = duration * zoomLevel;
    const height = canvas.height;
    canvas.width = width;
    
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8'; // sky-400
    ctx.lineWidth = 1;

    const step = Math.ceil(loudnessData.length / width);
    const amp = height / 2;

    for (let i = 0; i < width; i++) {
       let min = 1.0;
       let max = -1.0;
       for (let j = 0; j < step; j++) {
         const datum = loudnessData[(i * step) + j];
         if (datum < min) min = datum;
         if (datum > max) max = datum;
       }
       ctx.moveTo(i, (1 + min) * amp);
       ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
  }, [loudnessData, zoomLevel, duration]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} height={100} className="w-full h-full opacity-40 pointer-events-none" />
    </div>
  );
};
