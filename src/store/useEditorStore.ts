/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { Segment, DetectionSettings, MediaMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface EditorState {
  // Media State
  mediaFile: File | null;
  videoUrl: string | null;
  audioBuffer: AudioBuffer | null;
  metadata: MediaMetadata | null;
  isReady: boolean;

  // Playback State
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  skipSilence: boolean;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisPhase: string;
  
  // Editor State
  segments: Segment[];
  selectedSegmentIds: string[];
  zoomLevel: number;
  
  // Settings
  detectionSettings: DetectionSettings;
  
  // Actions
  setMedia: (file: File, url: string, metadata: MediaMetadata) => void;
  setAudioBuffer: (buffer: AudioBuffer | null) => void;
  setReady: (ready: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setSkipSilence: (skip: boolean) => void;
  setZoomLevel: (zoom: number) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setAnalysisProgress: (progress: number) => void;
  setAnalysisPhase: (phase: string) => void;
  
  // Segment Actions
  setSegments: (segments: Segment[]) => void;
  updateSegmentType: (id: string, type: 'keep' | 'remove') => void;
  toggleSegmentType: (ids: string[]) => void;
  splitSegmentAt: (time: number) => void;
  deleteSegments: (ids: string[]) => void;
  deleteSilenceSegments: () => void;
  
  // Selection
  setSelectedSegments: (ids: string[]) => void;
  
  // Detection
  updateDetectionSettings: (settings: Partial<DetectionSettings>) => void;

  // Reset
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mediaFile: null,
  videoUrl: null,
  audioBuffer: null,
  metadata: null,
  isReady: false,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playbackRate: 1,
  skipSilence: true,
  isAnalyzing: false,
  analysisProgress: 0,
  analysisPhase: '',
  segments: [],
  selectedSegmentIds: [],
  zoomLevel: 100, // pixels per second roughly
  detectionSettings: {
    thresholdDb: -30,
    minSilenceDuration: 0.5,
    paddingBefore: 0.1,
    paddingAfter: 0.2,
    mergeGaps: 0.1,
  },

  setMedia: (file, url, metadata) => set({ 
    mediaFile: file, 
    videoUrl: url, 
    metadata, 
    currentTime: 0,
    duration: metadata.duration,
    isReady: true 
  }),
  setAudioBuffer: (audioBuffer) => set({ audioBuffer }),
  setReady: (ready) => set({ isReady: ready }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setSkipSilence: (skipSilence) => set({ skipSilence }),
  setZoomLevel: (zoom) => set({ zoomLevel: Math.max(10, Math.min(zoom, 1000)) }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setAnalysisProgress: (analysisProgress) => set({ analysisProgress }),
  setAnalysisPhase: (analysisPhase) => set({ analysisPhase }),

  setSegments: (segments) => set({ segments }),

  updateSegmentType: (id, type) => set((state) => ({
    segments: state.segments.map(s => s.id === id ? { ...s, type, manual: true } : s)
  })),

  toggleSegmentType: (ids) => set((state) => ({
    segments: state.segments.map(s => 
      ids.includes(s.id) 
        ? { ...s, type: s.type === 'keep' ? 'remove' : 'keep', manual: true } 
        : s
    )
  })),

  splitSegmentAt: (time) => set((state) => {
    // Boundary check using >= and < to catch start of segments
    const segmentIndex = state.segments.findIndex(s => time >= s.start && time < s.end);
    if (segmentIndex === -1) return state;

    const segment = state.segments[segmentIndex];
    
    // Safety check for microscopic segments (less than 10ms)
    if (time - segment.start < 0.01 || segment.end - time < 0.01) {
      console.warn('[STORE] Refusing split: result too small', { time, segment });
      return state;
    }

    const newSegments = [...state.segments];
    
    const segmentA: Segment = {
      ...segment,
      id: uuidv4(),
      end: time,
      manual: true
    };
    
    const segmentB: Segment = {
      ...segment,
      id: uuidv4(),
      start: time,
      manual: true
    };

    newSegments.splice(segmentIndex, 1, segmentA, segmentB);
    console.log('[STORE] Split segment at', time, 'Indices:', segmentIndex);
    return { segments: newSegments };
  }),

  deleteSegments: (ids) => set((state) => {
    return {
       segments: state.segments.map(s => ids.includes(s.id) ? { ...s, type: 'remove', manual: true } : s)
    };
  }),

  deleteSilenceSegments: () => set((state) => {
    const silencesCount = state.segments.filter(s => s.type === 'remove').length;
    console.log(`[STORE] Deleting ${silencesCount} silence segments.`);
    return {
      segments: state.segments.filter(s => s.type === 'keep')
    };
  }),

  setSelectedSegments: (ids) => set({ selectedSegmentIds: ids }),

  updateDetectionSettings: (settings) => set((state) => ({
    detectionSettings: { ...state.detectionSettings, ...settings }
  })),

  reset: () => set({
    mediaFile: null,
    videoUrl: null,
    metadata: null,
    isReady: false,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    playbackRate: 1,
    segments: [],
    selectedSegmentIds: [],
  }),
}));
