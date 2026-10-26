export const PROVIDER_HOSTS: Record<string, string[]>;
export function isHostAllowed(providerKey: string, host: string): boolean;
export function allAllowedHosts(): Set<string>;
