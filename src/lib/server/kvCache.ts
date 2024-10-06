// Generic type for PastKeyValues
type PastKeyValues = any; // This should be replaced with the actual type when available

interface KVCache {
    [contextId: string]: {
        pastKeyValues: PastKeyValues;
        lastUsed: number;
    };
}

const kv_cache: KVCache = {};

export function getCachedKeyValues(contextId: string): PastKeyValues | undefined {
    const entry = kv_cache[contextId];
    if (entry) {
        entry.lastUsed = Date.now();
        return entry.pastKeyValues;
    }
    return undefined;
}

export function setCachedKeyValues(contextId: string, pastKeyValues: PastKeyValues): void {
    kv_cache[contextId] = {
        pastKeyValues,
        lastUsed: Date.now()
    };
    maintainCache();
}

export function clearCache(contextId: string): void {
    delete kv_cache[contextId];
}

// Implement cache eviction policy
function evictOldEntries() {
    const maxEntries = 1000; // Adjust based on your needs
    const entries = Object.entries(kv_cache);
    if (entries.length > maxEntries) {
        const sortedEntries = entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        const entriesToRemove = sortedEntries.slice(0, entries.length - maxEntries);
        entriesToRemove.forEach(([key]) => delete kv_cache[key]);
    }
}

// Call this function periodically or when adding new entries
export function maintainCache() {
    evictOldEntries();
}