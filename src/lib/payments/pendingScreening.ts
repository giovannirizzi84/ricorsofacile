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

const databaseName = "multeonline-payments";
const databaseVersion = 1;
const storeName = "pending-screenings";

export async function savePendingScreening(payload: PendingScreening) {
  const db = await openDatabase();
  await runStoreOperation(db, "readwrite", (store) => store.put(payload));
  db.close();
}

export async function readPendingScreening(sessionId: string) {
  const db = await openDatabase();
  const record = await runRequest<PendingScreening | undefined>(
    db.transaction(storeName, "readonly").objectStore(storeName).get(sessionId),
  );
  db.close();
  return record ?? null;
}

export async function deletePendingScreening(sessionId: string) {
  const db = await openDatabase();
  await runStoreOperation(db, "readwrite", (store) => store.delete(sessionId));
  db.close();
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
