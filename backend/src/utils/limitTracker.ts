export type ProviderStatus = 'healthy' | 'rate_limited' | 'error';

interface ProviderState {
    status: ProviderStatus;
    lastError?: string;
    requestsPerMinute: number;
    requestsPerDay: number;
    tokensPerMinute: number;
    tokensPerDay: number;
    resetMinute: number;
    resetDay: number;
}

export const providerStates: Record<string, ProviderState> = {};

export function updateProviderCalls(upstreamKeyId: string, tokens: number) {
    const now = new Date();
    const minute = now.getMinutes();
    const day = now.getDate();

    let state = providerStates[upstreamKeyId];
    if (!state) {
        state = {
            status: 'healthy',
            requestsPerMinute: 0,
            requestsPerDay: 0,
            tokensPerMinute: 0,
            tokensPerDay: 0,
            resetMinute: minute,
            resetDay: day
        };
        providerStates[upstreamKeyId] = state;
    }

    if (state.resetMinute !== minute) {
        state.requestsPerMinute = 0;
        state.tokensPerMinute = 0;
        state.resetMinute = minute;
        // Simple recovery strategy after exactly 1 minute
        if (state.status === 'rate_limited') state.status = 'healthy';
        if (state.status === 'error') state.status = 'healthy';
    }

    if (state.resetDay !== day) {
        state.requestsPerDay = 0;
        state.tokensPerDay = 0;
        // Simple recovery strategy after 1 day
        if (state.status === 'rate_limited') state.status = 'healthy';
        state.resetDay = day;
    }

    state.requestsPerMinute++;
    state.requestsPerDay++;
    state.tokensPerMinute += tokens;
    state.tokensPerDay += tokens;
}

export function markProviderError(upstreamKeyId: string, errorType: 'rate_limited' | 'error', message: string) {
    const now = new Date();
    if (!providerStates[upstreamKeyId]) {
        providerStates[upstreamKeyId] = {
            status: 'healthy',
            requestsPerMinute: 0,
            requestsPerDay: 0,
            tokensPerMinute: 0,
            tokensPerDay: 0,
            resetMinute: now.getMinutes(),
            resetDay: now.getDate()
        };
    }
    providerStates[upstreamKeyId].status = errorType;
    providerStates[upstreamKeyId].lastError = message;
}
