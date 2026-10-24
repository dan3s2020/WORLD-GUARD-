/** Local-only persistence. Failures are surfaced; there is no network upload. */
export function openCheckpointStore() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("worldguard-spatial-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("checkpoints");
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(Error("Close another WorldGuard tab to enable storage"));
    r.onsuccess = () => {
      const db = r.result;
      resolve({
        read: () =>
          new Promise((ok, no) => {
            const tx = db.transaction("checkpoints"),
              q = tx.objectStore("checkpoints").get("latest");
            q.onsuccess = () => ok(q.result ?? null);
            q.onerror = () => no(q.error);
          }),
        write: (value) =>
          new Promise((ok, no) => {
            const tx = db.transaction("checkpoints", "readwrite");
            tx.objectStore("checkpoints").put(value, "latest");
            tx.oncomplete = () => ok();
            tx.onerror = () => no(tx.error);
            tx.onabort = () =>
              no(tx.error || Error("Checkpoint write aborted"));
          }),
      });
    };
  });
}
