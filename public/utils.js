export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function chunkArray(array, chunkSize) {
  let chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export function arraysAreEqual(arr1, arr2) {
  return arr1.length === arr2.length && arr1.every((arr1Item, i) => arr1Item === arr2[i]);
}

export function isSubsetOf(arr1, arr2) {
  return arr2.every(arr2Item => arr1.includes(arr2Item));
}

export const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

export const base64encode = (input) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export const sha256 = (plain) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return window.crypto.subtle.digest('SHA-256', data)
}

export function wrapPromiseWithStatus(promise) {
  var wrappingPromise = { state: 'pending', promise };
  promise.then(
    () => { wrappingPromise.state = 'fulfilled'; },
    () => { wrappingPromise.state = 'rejected'; }
  );
  return wrappingPromise;
}

export function calculatePercentage(value, minValue, maxValue) {
  const range = Math.abs(maxValue - minValue);
  const relativeValue = value - minValue;
  return (relativeValue / range) * 100;
}