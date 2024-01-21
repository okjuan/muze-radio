const USER_AUTH_DATA_KEY = "userAuthData";
const EXPIRY_BUFFER_IN_SECONDS = 5;

export function isFirstTimeUser() {
    const hasUsedBefore = JSON.parse(localStorage.getItem('hasUsedBefore') || 'false');
    if (!hasUsedBefore) {
    localStorage.setItem('hasUsedBefore', JSON.stringify(true));
    }
    return !hasUsedBefore;
}

export function clearAuthCache() {
    removeFromCache(USER_AUTH_DATA_KEY);
}

export function cacheUserAuthData(userAuthData) {
    // properties: access_token, token_type, scope, expires_in, refresh_token
    const now = new Date().getTime();
    userAuthData['expiresAt'] = now + (userAuthData['expires_in'] - EXPIRY_BUFFER_IN_SECONDS) * 1000;
    localStorage.setItem(USER_AUTH_DATA_KEY, JSON.stringify(userAuthData));
}

export function getUserAuthData() {
    return JSON.parse(localStorage.getItem(USER_AUTH_DATA_KEY));
}

export function removeFromCache(key) {
    localStorage.removeItem(key);
}

export function getFromCache(key) {
    return localStorage.getItem(key);
}

export function cache(key, str) {
    localStorage.setItem(key, str);
}