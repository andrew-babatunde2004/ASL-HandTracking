import { openDB, type DBSchema } from 'idb';
import type { Recording } from './types';

interface StudioDB extends DBSchema {
  recordings: { key: string; value: Recording };
}
const database = () => openDB<StudioDB>('asl-studio', 1, {
  upgrade(db) { db.createObjectStore('recordings', { keyPath: 'id' }); },
});
export async function listRecordings() {
  const db = await database();
  try { return (await db.getAll('recordings')).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
  finally { db.close(); }
}
export async function saveRecording(recording: Recording) {
  if (!recording.frames.some(frame => frame.hands.length)) throw new Error('No hands were captured. Keep a hand in view and try again.');
  const db = await database();
  try { await db.put('recordings', recording); } finally { db.close(); }
}
export async function deleteRecording(id: string) {
  const db = await database();
  try { await db.delete('recordings', id); } finally { db.close(); }
}
export function exportRecording(recording: Recording) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(recording)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `asl-${recording.label.replace(/[^a-z0-9-]/gi, '-').slice(0,60)}-${recording.id.slice(0,8)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
