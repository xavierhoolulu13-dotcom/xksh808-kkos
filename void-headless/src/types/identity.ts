export interface Identity {
  id: string;
  name: string;
  publicKey: string;
  privateKey?: string;
  created: number;
  metadata: Record<string, unknown>;
}

export interface IdentityStore {
  primary: Identity;
  aliases: Identity[];
}
