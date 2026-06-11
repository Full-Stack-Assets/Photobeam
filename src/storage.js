// Native storage layer for PhotoBeam on iOS (Capacitor).
//
// Strategy: small metadata (albums + photo records minus image data) lives in
// Preferences; the actual JPEG bytes live as files in the app's Data directory.
// This keeps Preferences tiny and avoids the "giant base64 blob" problem.

import { Preferences } from "@capacitor/preferences";
import { Filesystem, Directory } from "@capacitor/filesystem";

const META_KEY = "photobeam-meta-v1";

// Load albums + imported photos. Image data is read back from disk and
// rehydrated into the same `img` data-URL shape the component already uses.
export async function loadState() {
  const r = await Preferences.get({ key: META_KEY });
  if (!r.value) return null;

  let meta;
  try {
    meta = JSON.parse(r.value);
  } catch {
    return null;
  }

  const imported = [];
  for (const m of meta.imported || []) {
    try {
      const f = await Filesystem.readFile({
        path: m.file,
        directory: Directory.Data,
      });
      imported.push({ ...m, img: `data:image/jpeg;base64,${f.data}` });
    } catch {
      // File missing (e.g. cleared by OS) — skip the record.
    }
  }

  return { albums: meta.albums || [], imported };
}

// Persist metadata only. Strips the heavy `img` field; images were already
// written to disk at import time by saveImage().
export async function saveMeta(albums, imported) {
  const meta = {
    albums,
    imported: imported.map(({ img, ...rest }) => rest),
  };
  await Preferences.set({ key: META_KEY, value: JSON.stringify(meta) });
}

// Write one downscaled JPEG (as a data URL) to disk. Returns the relative
// file path to store in the photo record.
export async function saveImage(id, dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const file = `photos/${id}.jpg`;
  await Filesystem.writeFile({
    path: file,
    directory: Directory.Data,
    data: base64,
    recursive: true,
  });
  return file;
}

export async function deleteImage(file) {
  try {
    await Filesystem.deleteFile({ path: file, directory: Directory.Data });
  } catch {
    // already gone — fine
  }
}
