import {
    base64encode,
    chunkArray,
    generateRandomString,
    isSubsetOf,
    sha256,
    wrapPromiseWithStatus,
} from './utils.js';
import {
    cache,
    cacheUserAuthData,
    clearAuthCache,
    getFromCache,
    getUserAuthData,
    removeFromCache,
} from './cache.js';
import {
    SPOTIFY_REDIRECT_URI,
    SPOTIFY_APP_CLIENT_ID,
    SPOTIFY_MAX_PLAYLISTS_PER_REQUEST,
    SPOTIFY_MAX_SONGS_PER_ADD_TO_PLAYLIST_REQUEST,
    SPOTIFY_MAX_SONGS_PER_GET_RECOMMENDATIONS_REQUEST,
} from './constants.js';

var userPlaylists = undefined;
var userId = undefined;
let userAuthDataPromise = undefined;
const MARKET = 'US';
let SPOTIFY_SEED_GENRES = undefined;

export function getSpotifySeedGenres() {
    if (SPOTIFY_SEED_GENRES || (SPOTIFY_SEED_GENRES = getFromCache('spotify_seed_genres')?.split(' '))) {
        return Promise.resolve(SPOTIFY_SEED_GENRES);
    }
    return getUserAuth([]).then(authToken =>
        fetchWithRetry('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
        .then(response => response.json())
        .then(data => {
            cache('spotify_seed_genres', data.genres.join(' '));
            return (SPOTIFY_SEED_GENRES = data.genres);
        })
    ).catch(error => {
        console.debug(`Error occurred when fetching seed genres: ${error}`);
        return undefined;
    });
}

export function getUserAuth(spotifyScopes) {
    var userAuthData = getUserAuthData();
    if (userAuthDataPromise && userAuthDataPromise.state === 'pending') {
        return userAuthDataPromise.promise;
    }
    if (shouldPromptForUserAuth(userAuthData, spotifyScopes)) {
        const request = requestToken(spotifyScopes);
        userAuthDataPromise = wrapPromiseWithStatus(request);
        return request;
    }
    if (shouldRenewToken(userAuthData)) {
        const refreshRequest = refreshAccessToken(userAuthData);
        userAuthDataPromise = wrapPromiseWithStatus(refreshRequest);
        return refreshRequest.then(token => {
            if (token) {
                return token;
            }
            userAuthDataPromise = undefined;
            clearAuthCache();
            removeFromCache('code_verifier');
            const authRequest = requestToken(spotifyScopes);
            userAuthDataPromise = wrapPromiseWithStatus(authRequest);
            return authRequest;
        });
    }
    return Promise.resolve(userAuthData.access_token);
}

function requestToken(spotifyScopes) {
    if (!window.location.search) {
        // Step 1: Generate a code verifier and a code challenge
        let codeVerifier = generateRandomString(128);
        cache('code_verifier', codeVerifier);

        sha256(codeVerifier).then((hash) => {
            // Step 2: Redirect the user to the authorization endpoint
            let authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_APP_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}${spotifyScopes.length > 0 ? `&scope=${encodeURIComponent(spotifyScopes.join(' '))}` : ''}&code_challenge=${base64encode(hash)}&code_challenge_method=S256`;
            window.location.href = authUrl;
        });
        return Promise.resolve(undefined);
    }
    // Step 3: Get the authorization code from the query string
    let urlParams = new URLSearchParams(window.location.search);
    let authCode = urlParams.get('code');
    window.history.replaceState({}, document.title, window.location.pathname);

    // Step 4: Exchange the authorization code for an access token
    return fetchWithRetry('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: SPOTIFY_APP_CLIENT_ID,
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: SPOTIFY_REDIRECT_URI,
            code_verifier: getFromCache('code_verifier'),
        }),
    })
    .then(response => response.json())
    .then(data => {
        console.log("Got token from user auth", data);
        cacheUserAuthData(data);
        return data.access_token;
    });
}

const shouldPromptForUserAuth = (userAuthData, scopes) => {
    if (!userAuthData) {
        console.log('No token found');
        return true;
    } else if (!isSubsetOf(userAuthData.scope, scopes)) {
        console.log('New scopes requested');
        return true;
    }
    return false;
}

function shouldRenewToken(userAuthData) {
    const now = new Date().getTime();
    return userAuthData.expiresAt < now;
}

function refreshAccessToken(userAuthData) {
    return fetchWithRetry('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: userAuthData.refresh_token,
            client_id: SPOTIFY_APP_CLIENT_ID
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            if (data.error === 'invalid_grant') {
                return undefined;
            } else {
                throw new Error(data.error);
            }
        } else {
            console.log("Refreshed token", data);
            cacheUserAuthData(data);
            return data;
        }
    });
}

export function addSongsToPlaylist(playlistId, songUris, position=undefined) {
    const authScopes = ['playlist-modify-private', 'playlist-modify-public'];
    const songUriBatches = chunkArray(songUris, SPOTIFY_MAX_SONGS_PER_ADD_TO_PLAYLIST_REQUEST);
    var songsAdded = 0;
    var requests = [];
    for (const songUriBatch of songUriBatches) {
        const queryParams = `uris=${songUriBatch.join(',')}` + (position !== undefined? `&position=${position + songsAdded}` : '');
        const request = getUserAuth(authScopes).then(authToken =>
            fetchWithRetry(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?${queryParams}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
            })).then(response => response.json());
        requests.push(request);
        songsAdded += songUriBatch.length;
    }
    return Promise.all(requests);
}

export function getRecommendations(audioFeatures, genres) {
    var queryParams = `seed_genres=${genres.join(',')}&limit=${SPOTIFY_MAX_SONGS_PER_GET_RECOMMENDATIONS_REQUEST}&market=${MARKET}`
    queryParams += Object.entries(audioFeatures)
        .map(([audioFeature, parameters]) => `&${parameters.targetValue? `target_${audioFeature}=${parameters.targetValue}&` : ''}min_${audioFeature}=${parameters.minValue}&max_${audioFeature}=${parameters.maxValue}`)
        .join('&');
    return getUserAuth([]).then(token => requestRecommendations(token, queryParams));
}

function requestRecommendations(token, queryParams) {
    // e.g. target_popularity=100&target_energy=80&target_acousticness=80&target_loudness=50&target_instrumentalness=100
    console.log('queryParams', queryParams);
    return fetchWithRetry(`https://api.spotify.com/v1/recommendations?${queryParams}`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => response.json())
    .catch(error => console.error('Error:', error));
}

export function getSpotifyAudioFeatures(songIds) {
    return getUserAuth([]).then(authToken =>
        fetchWithRetry(`https://api.spotify.com/v1/audio-features?ids=${songIds.join(',')}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + authToken
            }
        })
    )
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        return data.audio_features;
    })
    .catch(error => {
        console.error('Error:', error);
        return [];
    });
}

function fetchWithRetry(url, options, retries = 3, backoffSeconds = 0.3) {
    return fetch(url, options)
        .then(res => {
            if (res.status === 429 && retries > 0) {
                const retryAfter = res.headers.get('Retry-After') || backoffSeconds;
                return new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
                    .then(() => fetchWithRetry(url, options, retries - 1, backoffSeconds * 2));
            }
            return res;
        })
        .catch(error => {
            if (retries > 0) {
                return new Promise(resolve => setTimeout(resolve, backoffSeconds))
                    .then(() => fetchWithRetry(url, options, retries - 1, backoffSeconds * 2));
            }
            throw error;
        });
}

function getCurrentUserId() {
    if (userId) {
        return Promise.resolve(userId);
    }
    return getUserAuth(['user-read-private']).then((authToken) =>
        fetchWithRetry('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': 'Bearer ' + authToken
            }
        })
    )
    .then(response => response.json())
    .then(data => (userId = data.id))
    .catch(error => console.error('Error:', error));
}

export function isSavedToLikedSongs(spotifyId) {
    return getUserAuth(['user-library-read']).then((authToken) =>
        fetchWithRetry(`https://api.spotify.com/v1/me/tracks/contains?ids=${spotifyId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
    )
    .then((response) => response.json())
    .then((responseJson) => {
        return responseJson;
    });
}

export function removeFromLikedSongs(spotifyId) {
    return getUserAuth(['user-library-read']).then(authToken =>
        fetchWithRetry(`https://api.spotify.com/v1/me/tracks?ids=${spotifyId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
    );
}

export function saveToLikedSongs(spotifyId) {
    return getUserAuth(['user-library-read']).then(authToken =>
        fetchWithRetry(`https://api.spotify.com/v1/me/tracks`, {
            method: 'PUT',
            body: JSON.stringify({ ids: [spotifyId]}),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
    );
}

export function transferPlayback(device_id) {
    return getUserAuth(['user-modify-playback-state']).then((authToken) =>
        fetchWithRetry(`https://api.spotify.com/v1/me/player`, {
            method: 'PUT',
            body: JSON.stringify({ device_ids: [device_id], play: true}),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
    );
}

export function playSongs(device_id, spotify_uris) {
    getUserAuth(['user-modify-playback-state']).then(authToken =>
        fetchWithRetry(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
            method: 'PUT',
            body: JSON.stringify({ uris: spotify_uris }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
    );
}

export function getUserPlaylists() {
    if (userPlaylists) {
        return userPlaylists;
    }
    return (userPlaylists = getCurrentUserId().then(userId => {
        const editableByUser = (playlist) =>
            userId === playlist.owner.id || playlist.collaborative;
        return getUserPlaylistsRecursively(0, SPOTIFY_MAX_PLAYLISTS_PER_REQUEST)
            .then((playlists) => playlists.filter(editableByUser));
    }));
}

export function getUserPlaylistsRecursively(offset, limit) {
    return getUserAuth(['playlist-read-private']).then(authToken =>
        fetchWithRetry(`https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
    )
    .then(response => response.json())
    .then(data => {
        if (data.items.length === limit) {
            return getUserPlaylistsRecursively(offset + limit, limit)
                .then(nextItems => data.items.concat(nextItems));
        } else {
            return data.items;
        }
    });
}

export function getAlbum(albumId) {
    return getUserAuth([]).then(authToken =>
        fetchWithRetry(`https://api.spotify.com/v1/albums/${albumId}?market=${MARKET}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error.message);
            }
            return data;
        })
    )
    .then(response => response.json())
    .catch(error => {
        console.debug(`Error occurred when fetching album with id=${albumId}: ${error}`);
        return undefined;
    });
}

export function getSong(songId) {
    return getUserAuth([]).then(authToken =>
        fetchWithRetry(`https://api.spotify.com/v1/tracks/${songId}?market=${MARKET}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error.message);
            }
            return data;
        })
    ).catch(error => {
        console.debug(`Error occurred when fetching track with id=${songId}: ${error}`);
        return undefined;
    });
}

export function getArtists(artistIds) {
    return getUserAuth([]).then(authToken =>
        fetchWithRetry(`https://api.spotify.com/v1/artists?ids=${artistIds.join(',')}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
    )
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        return data;
    });
}

export function getIdFromUri(uri) {
    return uri.split(':')[2];
}