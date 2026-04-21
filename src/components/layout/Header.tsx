/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { exportVideo } from '../../services/ffmpegService';
import { getAudioBuffer, analyzeAudio } from '../../utils/audioAnalysis';
import { FileUp, Save, FolderOpen, Download, Scissors, Loader2, RefreshCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ProjectData } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export const Header: React.FC = () => {
  const { 
    mediaFile, 
    setMedia, 
    reset, 
    segments, 
    detectionSettings, 
    duration, 
    metadata,
    isReady,
    setSegments,
    audioBuffer,
    setAudioBuffer,
    splitSegmentAt,
    currentTime,
    isAnalyzing,
    setIsAnalyzing,
    analysisProgress,
    setAnalysisProgress,
    analysisPhase,
    setAnalysisPhase
  } = useEditorStore();
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    reset();
    setIsAnalyzing(true);
    setAnalysisProgress(1);
    setAnalysisPhase('Loading Engine UI...');
    
    try {
      const url = URL.createObjectURL(file);
      
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject('Failed to load video metadata');
        setTimeout(() => reject('Video metadata timeout'), 10000);
      });
      
      setMedia(file, url, {
        name: file.name,
        size: file.size,
        type: file.type,
        duration: video.duration,
      });

      // Initialize with a single "keep" segment
      setSegments([{
        id: uuidv4(),
        start: 0,
        end: video.duration,
        type: 'keep'
      }]);

      // Stage 1: Extraction
      setAnalysisPhase('Downloading Media Engine...');
      setAnalysisProgress(5); // Immediate visual kick
      
      const buffer = await getAudioBuffer(file, (p, phase) => {
        if (phase) setAnalysisPhase(phase);
        // Map 0-100 to 5-55 range to ensure we never sit at 0
        setAnalysisProgress(5 + Math.floor(p * 0.5));
      });
      
      // Artificial bump for decoding phase visibility
      setAnalysisPhase('Decoding Audio...');
      setAnalysisProgress(60); 

      setAudioBuffer(buffer);
      
      // Stage 2: Scanning
      setAnalysisPhase('Logic Analysis...');
      const initialSegments = await analyzeAudio(buffer, detectionSettings, (p) => {
        // Map 0-100 to 70-100 range
        setAnalysisProgress(70 + Math.floor(p * 0.3));
      });
      setSegments(initialSegments);
      
    } catch (error) {
      console.error('Failed to load media:', error);
      alert(`Error loading media file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisPhase('');
    }
  };

  const handleExport = async () => {
    if (!mediaFile || segments.length === 0) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const blob = await exportVideo(mediaFile, segments, (p) => setExportProgress(p));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mediaFile.name.replace(/\.[^/.]+$/, "") + "_maymay.mp4";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Check console.');
    } finally {
      setIsExporting(false);
    }
  };

  const saveProject = () => {
    if (!metadata) return;
    const project: ProjectData = {
      version: '1.0',
      originalFilename: metadata.name,
      settings: detectionSettings,
      segments,
      duration: metadata.duration
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = metadata.name + ".maymay.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const project: ProjectData = JSON.parse(ev.target?.result as string);
        setSegments(project.segments);
        // Matching file is handled by user separately for now, 
        // as we can't easily re-link local files by path in browser.
        alert(`Project settings and cuts loaded for: ${project.originalFilename}. Please ensure you have the correct video loaded.`);
      } catch (e) {
        alert('Invalid project file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 z-50">
      {/* Analysis Backdrop */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
          <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden mb-4 border border-white/5">
            <div 
              className="h-full bg-sky-500 transition-all duration-300 ease-out" 
              style={{ width: `${analysisProgress}%` }} 
            />
          </div>
          <div className="flex items-center gap-3 text-white font-black text-xs uppercase tracking-[0.2em] italic">
            <RefreshCcw className="w-4 h-4 animate-spin text-sky-500" />
            {analysisPhase || 'Analyzing Audio'} ({analysisProgress}%)
          </div>
          <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">Processing 100% locally in your browser</p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center shadow-lg shadow-sky-500/20">
          <Scissors className="text-slate-950 w-5 h-5" />
        </div>
        <div className="flex items-baseline gap-2">
          <h1 className="font-black text-lg tracking-tighter italic text-white uppercase">Video Maymay</h1>
          <span className="text-[10px] font-bold text-slate-500 tracking-normal uppercase">v1.0 Pro</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="video/*,audio/*"
          onChange={handleFileChange}
        />
        <input 
          type="file" 
          ref={projectInputRef} 
          className="hidden" 
          accept=".json"
          onChange={loadProject}
        />

        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded hover:bg-slate-900 border border-transparent hover:border-slate-800 text-slate-400 transition-all"
          title="Open Video"
        >
           <FolderOpen className="w-5 h-5" />
        </button>

        <button 
           onClick={() => projectInputRef.current?.click()}
           className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700"
        >
          Load Project
        </button>

        <button 
           onClick={saveProject}
           disabled={!isReady}
           className="p-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white transition-colors disabled:opacity-30"
           title="Save Project"
        >
          <Save className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-800 mx-1" />

        <button 
           onClick={handleExport}
           disabled={!mediaFile || isExporting}
           className={cn(
             "px-6 py-2 rounded text-[10px] font-black uppercase tracking-[0.2em] transition-all",
             isExporting 
              ? "bg-sky-500/50 text-slate-950 cursor-wait" 
              : "bg-white hover:bg-slate-200 text-slate-950 shadow-lg active:scale-95"
           )}
        >
          {isExporting ? (
             <span className="flex items-center gap-2">
               <Loader2 className="w-3 h-3 animate-spin" />
               {(exportProgress * 100).toFixed(0)}%
             </span>
          ) : 'Export MP4'}
        </button>
      </div>
    </header>
  );
};
