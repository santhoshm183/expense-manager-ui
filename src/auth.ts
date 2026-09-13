export type AuthSession = {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
};

export const AUTH_STORAGE_KEY = "expense-manager-auth";

const originalFetch = globalThis.fetch.bind(globalThis);

export function getStoredAuth(): AuthSession | null {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw) as AuthSession;
    } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
    }
}

export function saveStoredAuth(auth: AuthSession) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthRoleFromToken(): string | null {
    const auth = getStoredAuth();
    if (!auth || !auth.accessToken) return null;

    try {
        const base64Payload = auth.accessToken.split(".")[1];
        if (!base64Payload) return null;
        const payload = JSON.parse(atob(base64Payload));
        return payload.role ?? null;
    } catch {
        return null;
    }
}

export function getAuthMemberIdFromToken(): string | null {
    const auth = getStoredAuth();
    if (!auth || !auth.accessToken) return null;

    try {
        const base64Payload = auth.accessToken.split(".")[1];
        if (!base64Payload) return null;
        const payload = JSON.parse(atob(base64Payload));
        return payload.memberId ?? null;
    } catch {
        return null;
    }
}

export function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const auth = getStoredAuth();
    const headers = new Headers(init.headers ?? {});

    if (auth && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${auth.accessToken}`);
    }

    return originalFetch(input, {
        ...init,
        headers,
    });
}

globalThis.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    const auth = getStoredAuth();
    const headers = new Headers(init.headers ?? {});

    if (auth && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${auth.accessToken}`);
    }

    return originalFetch(input, {
        ...init,
        headers,
    }).then((response) => {
        if (response.status === 401 && auth) {
            clearStoredAuth();
            window.dispatchEvent(new Event("auth:expired"));
        }
        return response;
    });
}) as typeof fetch;
