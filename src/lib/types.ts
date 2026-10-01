export interface Point { x: number; y: number; z: number }
export interface Hand {
  side: string;
  handednessScore: number;
  landmarks: Point[];
  worldLandmarks: Point[];
}
export interface Frame { timestampMs: number; hands: Hand[] }
export interface Recording {
  id: string;
  schemaVersion: 1;
  label: string;
  createdAt: string;
  durationMs: number;
  source: { width: number; height: number; mirrored: false };
  model: 'mediapipe-hand-landmarker-float16-v1';
  frames: Frame[];
}
export const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20],
];
