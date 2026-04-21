/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { getAudioBuffer, analyzeAudio } from '../../utils/audioAnalysis';
import { Settings2, Keyboard, Zap, Info, RefreshCcw, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Sidebar: React.FC = () => {
  const { 
    detectionSettings, 
    updateDetectionSettings, 
    mediaFile, 
    audioBuffer,
    setSegments,
    segments,
    skipSilence,
    setSkipSilence,
    deleteSilenceSegments,
    isReady,
    isAnalyzing,
    setIsAnalyzing,
    analysisProgress,
    setAnalysisProgress,
    analysisPhase,
    setAnalysisPhase
  } = useEditorStore();
  
  const handleApply = async () => {
    if (!audioBuffer) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisPhase('Applying Logic...');
    try {
      const newSegments = await analyzeAudio(audioBuffer, detectionSettings, (p) => setAnalysisProgress(p));
      setSegments(newSegments);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisPhase('');
    }
  };

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col overflow-y-auto custom-scrollbar p-6">
      <div className="flex items-center gap-2 mb-8 text-white/90">
        <Settings2 className="w-4 h-4 text-sky-500" />
        <h2 className="font-black text-xs uppercase tracking-tighter italic">Logic Settings</h2>
      </div>

      <div className="bg-sky-500/5 border border-sky-500/20 rounded p-3 mb-8">
        <div className="flex items-center gap-2 text-sky-400 font-bold text-[9px] uppercase tracking-widest mb-1.5">
           <Zap className="w-3 h-3 fill-sky-500" />
           Local DSP Engine
        </div>
        <p className="text-[10px] text-slate-500 leading-normal">
          Running 100% locally using RMS amplitude analysis. No data leaves your machine.
        </p>
      </div>

      <div className="space-y-8 flex-1">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="sidebar-label mb-0">Skip Silence</span>
            <button 
              onClick={() => setSkipSilence(!skipSilence)}
              className={cn(
                "w-10 h-5 rounded-full relative transition-colors duration-200",
                skipSilence ? "bg-sky-500" : "bg-slate-800"
              )}
            >
              <div className={cn(
                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200",
                skipSilence ? "left-6" : "left-1"
              )} />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">Automatically jump over parts marked as Silence during playback.</p>
        </div>

        <div className="space-y-3">
          <span className="sidebar-label">Silence Threshold</span>
          <div className="flex justify-between items-end mb-1">
            <span className="mono text-sky-500 text-xs">{detectionSettings.thresholdDb} dB</span>
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Master</span>
          </div>
          <input 
            type="range" 
            min="-60" 
            max="-10" 
            step="1"
            value={detectionSettings.thresholdDb}
            onChange={(e) => updateDetectionSettings({ thresholdDb: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        <div className="space-y-3">
          <span className="sidebar-label">Min Duration</span>
          <div className="flex justify-between items-end mb-1">
            <span className="mono text-sky-500 text-xs">{(detectionSettings.minSilenceDuration * 1000).toFixed(0)} ms</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="2.0" 
            step="0.1"
            value={detectionSettings.minSilenceDuration}
            onChange={(e) => updateDetectionSettings({ minSilenceDuration: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="sidebar-label">Padding (In)</span>
            <div className="mono text-sky-500 text-xs mb-1">{(detectionSettings.paddingBefore * 1000).toFixed(0)} ms</div>
            <input 
              type="range" 
              min="0" 
              max="1.0" 
              step="0.05"
              value={detectionSettings.paddingBefore}
              onChange={(e) => updateDetectionSettings({ paddingBefore: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500/50"
            />
          </div>
          <div className="space-y-2">
            <span className="sidebar-label">Padding (Out)</span>
            <div className="mono text-sky-500 text-xs mb-1">{(detectionSettings.paddingAfter * 1000).toFixed(0)} ms</div>
            <input 
              type="range" 
              min="0" 
              max="1.0" 
              step="0.05"
              value={detectionSettings.paddingAfter}
              onChange={(e) => updateDetectionSettings({ paddingAfter: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500/50"
            />
          </div>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleApply}
            disabled={!audioBuffer || isAnalyzing}
            className="w-full py-2 bg-white hover:bg-slate-200 text-slate-950 font-black text-xs uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 disabled:opacity-30 shadow-lg active:scale-95"
          >
            {isAnalyzing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : (
              <>
                <RefreshCcw className="w-4 h-4" />
                Apply Sync
              </>
            )}
          </button>

          <button 
            onClick={() => deleteSilenceSegments()}
            disabled={!isReady || segments.filter(s => s.type === 'remove').length === 0}
            className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 disabled:opacity-30 shadow-lg active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            Delete All Silences
          </button>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-slate-800">
        <span className="sidebar-label mb-4">Command Guide</span>
        
        <div className="grid grid-cols-2 gap-y-4 mb-8">
          <ShortcutItem keyLabel="Spc" action="Toggle" />
          <ShortcutItem keyLabel="S" action="Split" />
          <ShortcutItem keyLabel="L" action="Fast" />
          <ShortcutItem keyLabel="Del" action="Cut" />
          <ShortcutItem keyLabel="↑" action="Prev" />
          <ShortcutItem keyLabel="↓" action="Next" />
        </div>

        <div className="bg-slate-900 rounded p-4 border border-slate-800 hover:border-sky-500/30 transition-colors group">
          <a 
            href="https://SolomonChrist.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block mb-2"
          >
            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest group-hover:text-sky-400 transition-colors">By Solomon Christ</div>
            <div className="text-xs font-black italic text-white tracking-tight">SolomonChrist.com</div>
          </a>
          <a 
            href="https://www.skool.com/ai-ml-automation-mastery-2142/about" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded text-[9px] text-slate-300 font-bold uppercase tracking-widest hover:bg-sky-500 hover:text-slate-950 transition-all"
          >
            <Info className="w-3 h-3" />
            AI Mastery Skool
          </a>
        </div>
      </div>
    </aside>
  );
};

const ShortcutItem: React.FC<{ keyLabel: string, action: string }> = ({ keyLabel, action }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] text-slate-500 uppercase font-black">{action}</span>
    <kbd className="w-fit px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono text-[9px] min-w-[24px] text-center">{keyLabel}</kbd>
  </div>
);
