/**
 * Browser-native IndexedDB service for storing heavy media blobs,
 * PDF documents, occlusion images, and whiteboard drawings without
 * exhausting the 5MB synchronous localStorage quota.
 */

const DB_NAME = 'studify_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

export class IndexedDbService {
  private static dbPromise: Promise<IDBDatabase | null> | null = null;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined' && window.indexedDB !== null;
  }

  private static getDB(): Promise<IDBDatabase | null> {
    if (!this.isSupported()) {
      return Promise.resolve(null);
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (event) => {
          console.warn('[IndexedDbService] Failed to open IndexedDB:', (event.target as IDBOpenDBRequest).error);
          resolve(null);
        };
      } catch (err) {
        console.warn('[IndexedDbService] Exception opening IndexedDB:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public static async setItem(key: string, value: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('[IndexedDbService] Failed to set item:', e);
      return false;
    }
  }

  public static async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as string) || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('[IndexedDbService] Failed to get item:', e);
      return null;
    }
  }

  public static async removeItem(key: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      if (!db) return true;
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('[IndexedDbService] Failed to delete item:', e);
      return false;
    }
  }

  public static async clear(): Promise<boolean> {
    try {
      const db = await this.getDB();
      if (!db) return true;
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('[IndexedDbService] Failed to clear store:', e);
      return false;
    }
  }
}
