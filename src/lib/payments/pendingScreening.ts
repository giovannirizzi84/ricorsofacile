"use client";

export type PendingScreeningCaseData = {
  notificationDate: string;
  authority: string;
  amount: string;
  violationType: string;
};

export type PendingScreening = {
  sessionId: string;
  files: File[];
  caseData: PendingScreeningCaseData;
  createdAt: string;
};

export type PendingScreeningMetadata = {
  sessionId: string;
  fileCount: number;
  fileNames: string[];
  caseData: PendingScreeningCaseData;
  createdAt: string;
};

const databaseName = "multeonline-payments";
const databaseVersion = 1;
const storeName = "pending-screenings";
const metadataPrefix = "multeonline.pending-screening.";
const latestSessionKey = "multeonline.pending-screening.latest";

export async function savePendingScreening(payload: PendingScreening) {
  const db = await openDatabase();
  await runStoreOperation(db, "readwrite", (store) => store.put(payload));
  db.close();
  savePendingScreeningMetadata(payload);
}

export async function readPendingScreening(sessionId: string) {
  const db = await openDatabase();
  const record = await runRequest<PendingScreening | undefined>(
    db.transaction(storeName, "readonly").objectStore(storeName).get(sessionId),
  );
  db.close();
  return record ?? null;
}

export function readPendingScreeningMetadata(sessionId: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`${metadataPrefix}${sessionId}`);
    return raw ? (JSON.parse(raw) as PendingScreeningMetadata) : null;
  } catch {
    return null;
  }
}

export function readLatestPendingScreeningSessionId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(latestSessionKey) ?? "";
}

export async function deletePendingScreening(sessionId: string) {
  const db = await openDatabase();
  await runStoreOperation(db, "readwrite", (store) => store.delete(sessionId));
  db.close();
  deletePendingScreeningMetadata(sessionId);
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "sessionId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runStoreOperation(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    operation(store);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function runRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function savePendingScreeningMetadata(payload: PendingScreening) {
  if (typeof window === "undefined") return;

  const metadata: PendingScreeningMetadata = {
    sessionId: payload.sessionId,
    fileCount: payload.files.length,
    fileNames: payload.files.map((file) => file.name),
    caseData: payload.caseData,
    createdAt: payload.createdAt,
  };

  try {
    window.localStorage.setItem(`${metadataPrefix}${payload.sessionId}`, JSON.stringify(metadata));
    window.localStorage.setItem(latestSessionKey, payload.sessionId);
  } catch {
    // IndexedDB remains the source of truth for files. Metadata is best effort.
  }
}

function deletePendingScreeningMetadata(sessionId: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(`${metadataPrefix}${sessionId}`);
    if (window.localStorage.getItem(latestSessionKey) === sessionId) {
      window.localStorage.removeItem(latestSessionKey);
    }
  } catch {
    // Nothing to clean up if localStorage is unavailable.
  }
}
