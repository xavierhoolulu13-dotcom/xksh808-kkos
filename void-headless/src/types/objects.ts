export interface VoidObject {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
  nodeId: string;
  version: number;
}

export interface Lead extends VoidObject {
  type: 'lead';
  data: {
    name: string;
    channel: string;
    message: string;
    score: 'hot' | 'warm' | 'cold';
    status: 'new' | 'contacted' | 'won' | 'lost';
    phone?: string;
    email?: string;
  };
}

export interface Client extends VoidObject {
  type: 'client';
  data: {
    name: string;
    email: string;
    business: string;
    serviceType: string;
    status: 'trial' | 'active' | 'paused' | 'closed';
    paymentReceived: boolean;
  };
}
