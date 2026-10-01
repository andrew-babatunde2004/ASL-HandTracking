import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { deleteRecording, listRecordings, saveRecording } from './storage';
import type { Recording } from './types';

const sample: Recording = {
  id: 'storage-test', label: 'Letter A', schemaVersion: 1,
  createdAt: '2026-10-01T16:00:00Z', durationMs: 1000,
  source: { width: 1280, height: 720, mirrored: false },
  model: 'mediapipe-hand-landmarker-float16-v1',
  frames: [{ timestampMs: 100, hands: [{ side: 'Left', handednessScore: .98,
    landmarks: Array.from({ length: 21 }, () => ({ x: .4, y: .5, z: .01 })),
    worldLandmarks: Array.from({ length: 21 }, () => ({ x: .01, y: .02, z: .03 })),
  }] }],
};
describe('local recording persistence', () => {
  test('round-trips landmark coordinates, metadata, and timestamps across database connections', async () => {
    await saveRecording(sample);
    expect(await listRecordings()).toContainEqual(sample);
    await deleteRecording(sample.id);
    expect(await listRecordings()).not.toContainEqual(sample);
  });
  test('rejects recordings without any detected hands', async () => {
    await expect(saveRecording({ ...sample, frames: [] })).rejects.toThrow('No hands');
    await expect(saveRecording({ ...sample, frames: [{ timestampMs: 0, hands: [] }] })).rejects.toThrow('No hands');
  });
});
