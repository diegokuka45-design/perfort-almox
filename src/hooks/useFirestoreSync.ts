// ============================================================================
// Firestore Sync Hook — PerfortAlmox
// ============================================================================
// Subscribes to real-time Firestore updates and keeps localStorage cache
// in sync. Optionally loads data from Firestore on mount.
//
// Usage in App.tsx:
//   const { isLoading, syncStatus, loadData, syncToCloud } = useFirestoreSync();
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { db, hasRealConfig } from '../lib/firebase';
import {
  loadTenantDataFromFirestore,
  syncAllToFirestore,
  syncAllFromFirestore,
  subscribeToObras,
  subscribeToUsers,
} from '../lib/firestoreStorage';
import { getActiveObra, setActiveObra } from '../lib/storage';
import type { Unsubscribe } from 'firebase/firestore';

export interface SyncStatus {
  /** Whether Firestore is configured and connected */
  connected: boolean;
  /** Whether data has been loaded from Firestore at least once */
  loaded: boolean;
  /** Whether a sync operation is in progress */
  syncing: boolean;
  /** Last sync timestamp */
  lastSync: Date | null;
  /** Error message if sync failed */
  error: string | null;
}

export function useFirestoreSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: hasRealConfig && !!db,
    loaded: false,
    syncing: false,
    lastSync: null,
    error: null,
  });

  const unsubObras = useRef<Unsubscribe | null>(null);
  const unsubUsers = useRef<Unsubscribe | null>(null);

  // Subscribe to real-time updates on mount
  useEffect(() => {
    if (!hasRealConfig || !db) return;

    // Subscribe to obras
    unsubObras.current = subscribeToObras((obras) => {
      console.log('[FirestoreSync] Obras updated from Firestore');
    });

    // Subscribe to users
    unsubUsers.current = subscribeToUsers((users) => {
      console.log('[FirestoreSync] Users updated from Firestore');
    });

    return () => {
      unsubObras.current?.();
      unsubUsers.current?.();
    };
  }, []);

  /** Load data from Firestore into localStorage cache */
  const loadData = useCallback(async () => {
    if (!hasRealConfig || !db) return;

    setIsLoading(true);
    setSyncStatus(prev => ({ ...prev, syncing: true, error: null }));

    try {
      const obra = getActiveObra();
      if (obra) {
        await loadTenantDataFromFirestore(obra.id);
      }

      await syncAllFromFirestore();

      setSyncStatus({
        connected: true,
        loaded: true,
        syncing: false,
        lastSync: new Date(),
        error: null,
      });
    } catch (err: any) {
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: err.message || 'Failed to load from Firestore',
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Push current localStorage data to Firestore */
  const syncToCloud = useCallback(async () => {
    if (!hasRealConfig || !db) return;

    setSyncStatus(prev => ({ ...prev, syncing: true, error: null }));

    try {
      await syncAllToFirestore();

      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        lastSync: new Date(),
        error: null,
      }));
    } catch (err: any) {
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: err.message || 'Failed to sync to Firestore',
      }));
    }
  }, []);

  /** Load tenant data when active obra changes */
  const loadTenantData = useCallback(async (obraId: number | string) => {
    if (!hasRealConfig || !db) return;

    setIsLoading(true);
    try {
      await loadTenantDataFromFirestore(obraId);
      setSyncStatus(prev => ({ ...prev, loaded: true }));
    } catch (err: any) {
      console.error('[FirestoreSync] Error loading tenant data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    syncStatus,
    loadData,
    syncToCloud,
    loadTenantData,
  };
}
