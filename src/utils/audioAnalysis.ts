/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DetectionSettings, Segment } from '../types';
import { extractDownsampledAudio } from '../services/ffmpegService';
import { v4 as uuidv4 } from 'uuid';

export async function analyzeAudio(
  audioBuffer: AudioBuffer,
  settings: DetectionSettings,
  onProgress?: (progress: number) => void
): Promise<Segment[]> {
  const { thresholdDb, minSilenceDuration, paddingBefore, paddingAfter, mergeGaps } = settings;
  
  const sampleRate = audioBuffer.sampleRate;
  const rawData = audioBuffer.getChannelData(0); // Use first channel for analysis
  const duration = audioBuffer.duration;
  
  // Analysis parameters
  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
  const numFrames = Math.floor(rawData.length / frameSize);
  
  const loudness: number[] = [];
  
  // Calculate RMS loudness per frame in chunks to keep UI responsive
  const chunkSize = 5000;
  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    const start = i * frameSize;
    for (let j = 0; j < frameSize; j++) {
      const sample = rawData[start + j];
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / frameSize);
    // Convert to dB. 0dB is full scale.
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    loudness.push(db);

    // Update progress and yield every chunkSize frames
    if (i % chunkSize === 0 || i === numFrames - 1) {
      if (onProgress) onProgress(Math.floor((i / numFrames) * 100));
      // Yield to main thread
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const segments: Segment[] = [];
  let currentStart = 0;
  let isSilent = loudness[0] < thresholdDb;

  // Initial pass: detect blocks of silence vs sound
  for (let i = 1; i < numFrames; i++) {
    const frameIsSilent = loudness[i] < thresholdDb;
    if (frameIsSilent !== isSilent) {
      const endTime = (i * frameSize) / sampleRate;
      segments.push({
        id: uuidv4(),
        start: currentStart,
        end: endTime,
        type: isSilent ? 'remove' : 'keep'
      });
      currentStart = endTime;
      isSilent = frameIsSilent;
    }
  }
  
  // Push last segment
  segments.push({
    id: uuidv4(),
    start: currentStart,
    end: duration,
    type: isSilent ? 'remove' : 'keep'
  });

  // Second pass: apply minSilenceDuration
  // If a silence is too short, mark it as keep
  let filteredSegments: Segment[] = [];
  for (const seg of segments) {
    if (seg.type === 'remove' && (seg.end - seg.start) < minSilenceDuration) {
      filteredSegments.push({ ...seg, type: 'keep' });
    } else {
      filteredSegments.push(seg);
    }
  }

  // Merge adjacent segments of the same type
  filteredSegments = mergeAdjacent(filteredSegments);

  // Third pass: apply padding
  // Shift boundaries of "keep" segments
  const paddedSegments: Segment[] = [];
  for (let i = 0; i < filteredSegments.length; i++) {
    const seg = filteredSegments[i];
    if (seg.type === 'keep') {
      const newStart = Math.max(0, seg.start - paddingBefore);
      const newEnd = Math.min(duration, seg.end + paddingAfter);
      
      // If there was a previous segment, we only adjust its end IF it's a silence segment
      // to avoid shortening a previous sound segment with our new sound segment's padding
      if (paddedSegments.length > 0) {
        const prev = paddedSegments[paddedSegments.length - 1];
        if (prev.type === 'remove') {
          prev.end = newStart;
        }
      }
      
      paddedSegments.push({
        ...seg,
        start: newStart,
        end: newEnd
      });
    } else {
      // It's a remove segment. If the previous keep expanded, its start might change
      const prev = paddedSegments[paddedSegments.length - 1];
      const actualStart = prev ? prev.end : seg.start;
      
      // We don't know the next keep segment's start yet, so we'll just push it
      // and adjust it in the next iteration or a cleanup pass.
      paddedSegments.push({
        ...seg,
        start: actualStart
      });
    }
  }

  // Final cleanup: merge same types and ensure no overlaps/gaps
  let results = mergeAdjacent(paddedSegments);
  
  console.log(`[ANALYSIS] Complete. Found ${results.filter(s => s.type === 'keep').length} sound segments and ${results.filter(s => s.type === 'remove').length} silence segments.`);
  
  return results.filter(s => s.end > s.start);
}

function mergeAdjacent(segments: Segment[]): Segment[] {
  if (segments.length === 0) return [];
  const merged: Segment[] = [segments[0]];
  
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    const current = segments[i];
    
    if (last.type === current.type) {
      last.end = current.end;
    } else {
      // Ensure no gaps
      last.end = current.start;
      merged.push(current);
    }
  }
  return merged;
}

export async function getAudioBuffer(
  file: File, 
  onProgress?: (progress: number, phase?: string) => void
): Promise<AudioBuffer> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  let audioBlob: Blob;
  
  // If the file is a likely video or large file, use FFmpeg to extract a small WAV
  if (file.size > 100 * 1024 * 1024 || file.type.startsWith('video/')) {
    audioBlob = await extractDownsampledAudio(file, onProgress);
  } else {
    audioBlob = file;
    if (onProgress) onProgress(100, 'Loading Local File...');
  }
  
  const arrayBuffer = await audioBlob.arrayBuffer();
  if (onProgress) onProgress(95, 'Decoding Audio Engine...');
  // decodeAudioData is blocking/slow for large files and has no progress API.
  // By using 16kHz WAV above, we minimize this time.
  return await audioContext.decodeAudioData(arrayBuffer);
}
