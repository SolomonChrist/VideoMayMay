/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SegmentType = 'keep' | 'remove';

export interface Segment {
  id: string;
  start: number; // in seconds
  end: number; // in seconds
  type: SegmentType;
  manual?: boolean;
}

export interface DetectionSettings {
  thresholdDb: number;
  minSilenceDuration: number; // in seconds
  paddingBefore: number; // in seconds
  paddingAfter: number; // in seconds
  mergeGaps: number; // in seconds
}

export interface ProjectData {
  version: string;
  originalFilename: string;
  settings: DetectionSettings;
  segments: Segment[];
  duration: number;
}

export interface MediaMetadata {
  name: string;
  size: number;
  type: string;
  duration: number;
  width?: number;
  height?: number;
}
