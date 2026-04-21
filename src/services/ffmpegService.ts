/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Segment } from '../types';

let ffmpeg: FFmpeg | null = null;

export async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  
  // Use a more robust CDN version if unpkg is hanging
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  try {
    const loaded = await Promise.race([
      ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Media Engine Timeout')), 30000))
    ]);
    return ffmpeg;
  } catch (err) {
    ffmpeg = null; // Reset on failure
    throw err;
  }
}

export async function exportVideo(
  file: File,
  segments: Segment[],
  onProgress: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const filename = 'input_video';
  const extension = file.name.split('.').pop() || 'mp4';
  const inputName = `${filename}.${extension}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const keepSegments = segments.filter(s => s.type === 'keep');
  const tempFiles: string[] = [];

  ffmpeg.on('log', ({ message }) => {
    console.log(message);
  });

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress(progress * 100);
  };

  ffmpeg.on('progress', progressHandler);

  // For each segment, extract it
  // Using concat demuxer is more efficient for same-codec files
  const concatFileContent: string[] = [];
  
  for (let i = 0; i < keepSegments.length; i++) {
    const seg = keepSegments[i];
    const outputName = `part_${i}.mp4`;
    
    // Command to trim without re-encoding if possible, but for accuracy we might need re-encoding
    // -ss start -t duration
    // Using -c:v copy -c:a copy is fast but can be inaccurate with keyframes
    // For a "production grade" tool, we might want faster export for preview and re-encode for final.
    // Let's use re-encoding for precision in this version.
    await ffmpeg.exec([
      '-ss', seg.start.toString(),
      '-to', seg.end.toString(),
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'ultrafast', // fast for browser
      '-crf', '23',
      '-c:a', 'aac',
      outputName
    ]);
    
    tempFiles.push(outputName);
    concatFileContent.push(`file '${outputName}'`);
  }

  // Create concat file
  await ffmpeg.writeFile('concat.txt', concatFileContent.join('\n'));

  // Run concat
  await ffmpeg.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  
  ffmpeg.off('progress', progressHandler);

  // Cleanup
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('concat.txt');
  for (const f of tempFiles) {
    await ffmpeg.deleteFile(f);
  }
  await ffmpeg.deleteFile('output.mp4');

  return new Blob([(data as any).buffer], { type: 'video/mp4' });
}

export async function extractDownsampledAudio(
  file: File,
  onProgress?: (progress: number, phase?: string) => void
): Promise<Blob> {
  if (onProgress) onProgress(2, 'Booting Media Engine...');
  const ffmpeg = await getFFmpeg();
  
  const filename = 'input_audio_extract';
  const extension = file.name.split('.').pop() || 'mp4';
  const inputName = `${filename}.${extension}`;
  const outputName = 'downsampled.wav';

  const progressHandler = ({ progress }: { progress: number }) => {
    // FFmpeg progress is 0-1, convert to 0-100
    if (onProgress) onProgress(progress * 100, 'Analyzing Bitstream...');
  };

  if (onProgress) {
    ffmpeg.on('progress', progressHandler);
    onProgress(10, 'Preparing Virtual File System...');
  }

  // Pre-fetch file data
  try {
    const fileData = await fetchFile(file);
    if (onProgress) onProgress(20, 'Caching Video Data...');
    
    await ffmpeg.writeFile(inputName, fileData);
    if (onProgress) onProgress(30, 'Scanning Audio Streams...');

    // Extract audio, convert to mono, 16kHz sample rate
    // -vn: ignore video (huge speedup for probe)
    await ffmpeg.exec([
      '-i', inputName,
      '-vn', '-sn', '-dn',
      '-ar', '16000',
      '-ac', '1',
      outputName
    ]);

    const data = await ffmpeg.readFile(outputName);
    
    if (onProgress) {
      ffmpeg.off('progress', progressHandler);
    }

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return new Blob([(data as any).buffer], { type: 'audio/wav' });
  } catch (error) {
    console.error('FFmpeg Critical Error:', error);
    if (onProgress) ffmpeg.off('progress', progressHandler);
    throw error;
  }
}
