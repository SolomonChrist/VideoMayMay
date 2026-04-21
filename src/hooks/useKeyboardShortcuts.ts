/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/useEditorStore';

const SPEEDS = [1, 1.5, 2, 3, 4];

export function useKeyboardShortcuts() {
  const store = useEditorStore();
  
  // Use a ref to store current state so listener doesn't need to be recreated
  const stateRef = useRef(store);
  useEffect(() => {
    stateRef.current = store;
  }, [store]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const state = stateRef.current;
      const {
        isPlaying,
        setPlaying,
        playbackRate,
        setPlaybackRate,
        currentTime,
        setCurrentTime,
        splitSegmentAt,
        segments,
        selectedSegmentIds,
        toggleSegmentType,
        zoomLevel,
        setZoomLevel
      } = state;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setPlaying(!isPlaying);
          break;
        
        case 'KeyK':
          setPlaying(false);
          setPlaybackRate(1);
          break;

        case 'KeyL':
          // Cycle forward speeds
          const nextSpeedIndex = (SPEEDS.indexOf(playbackRate) + 1) % SPEEDS.length;
          setPlaybackRate(SPEEDS[nextSpeedIndex]);
          setPlaying(true);
          break;

        case 'KeyJ':
          // Jump back 5s
          setCurrentTime(Math.max(0, currentTime - 5));
          break;

        case 'KeyS':
          splitSegmentAt(currentTime);
          break;

        case 'Delete':
        case 'Backspace':
          if (selectedSegmentIds.length > 0) {
            toggleSegmentType(selectedSegmentIds);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          setCurrentTime(currentTime + (e.shiftKey ? 1 : 0.1));
          break;

        case 'ArrowLeft':
          e.preventDefault();
          setCurrentTime(Math.max(0, currentTime - (e.shiftKey ? 1 : 0.1)));
          break;

        case 'ArrowUp':
          e.preventDefault();
          // Find previous cut
          const prevCut = segments.slice().reverse().find(s => s.start < currentTime - 0.1);
          if (prevCut) setCurrentTime(prevCut.start);
          break;

        case 'ArrowDown':
          e.preventDefault();
          // Find next cut
          const nextCut = segments.find(s => s.start > currentTime + 0.1);
          if (nextCut) setCurrentTime(nextCut.start);
          break;

        case 'Equal': // + key
          if (e.ctrlKey || e.metaKey) {
             e.preventDefault();
             setZoomLevel(zoomLevel * 1.2);
          }
          break;

        case 'Minus':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoomLevel(zoomLevel / 1.2);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array
}
