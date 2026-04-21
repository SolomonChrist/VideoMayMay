/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { VideoPlayer } from './components/editor/VideoPlayer';
import { Timeline } from './components/editor/Timeline';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  // Activate keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-50 overflow-hidden selection:bg-sky-500/30">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 flex flex-col overflow-hidden relative bg-slate-900">
          <VideoPlayer />
          <Timeline />
        </main>
      </div>
    </div>
  );
}
