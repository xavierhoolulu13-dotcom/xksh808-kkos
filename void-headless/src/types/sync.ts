export interface SyncEvent {
  id: string;
  type: 'create' | 'update' | 'delete' | 'merge';
  entityType: string;
  entityId: string;
  data: unknown;
  timestamp: number;
  nodeId: string;
  vectorClock: Record<string, number>;
}

export interface SyncState {
  nodeId: string;
  peers: string[];
  lastSync: number;
  pendingEvents: SyncEvent[];
  vectorClock: Record<string, number>;
}
