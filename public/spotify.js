import {
    base64encode,
    chunkArray,
    generateRandomString,
    isSubsetOf,
    sha256,
    wrapPromiseWithStatus,
} from './utils.js';

const clientId = '8efedd3d29214978b2a0e6e63444974b';
export const spotifySeedGenres = ["acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues", "bossanova", "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical", "club", "comedy", "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco", "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel", "goth", "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk", "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance", "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc", "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party", "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b", "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly", "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter", "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study", "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music"];
export const maxPlaylistsPerRequest = 50;
const maxSongsPerAddToPlaylistRequest = 100;
export const maxSeedGenres = 5;
var userPlaylists = undefined;
var userId = undefined;
const userAuthDataKey = "userAuthData";
const expiryBufferInSeconds = 5;
const redirectUri = 'https://okjuan.me/muze-radio';
let userAuthDataPromise = undefined;

export function getUserAuth(spotifyScopes) {
    var userAuthData = JSON.parse(localStorage.getItem(userAuthDataKey));
    if (userAuthDataPromise && userAuthDataPromise.state === 'pending') {
        return userAuthDataPromise.promise;
    }
    if (shouldPromptForUserAuth(userAuthData, spotifyScopes)) {
        const request = requestToken(spotifyScopes);
        userAuthDataPromise = wrapPromiseWithStatus(request);
        return request;
    }
    if (shouldRenewToken(userAuthData)) {
        const request = refreshAccessToken(userAuthData);
        userAuthDataPromise = wrapPromiseWithStatus(request);
        return request;
    }
    return Promise.resolve(userAuthData['access_token']);
}

function requestToken(spotifyScopes) {
    if (!window.location.search) {
        // Step 1: Generate a code verifier and a code challenge
        let codeVerifier = generateRandomString(128);
        localStorage.setItem('code_verifier', codeVerifier);

        sha256(codeVerifier).then((hash) => {
            // Step 2: Redirect the user to the authorization endpoint
            let authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(spotifyScopes.join(' '))}&code_challenge=${base64encode(hash)}&code_challenge_method=S256`;
            window.location.href = authUrl;
        });
        return Promise.resolve(undefined);
    }
    // Step 3: Get the authorization code from the query string
    let urlParams = new URLSearchParams(window.location.search);
    let authCode = urlParams.get('code');
    window.history.replaceState({}, document.title, window.location.pathname);

    // Step 4: Exchange the authorization code for an access token
    return fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: redirectUri,
            code_verifier: localStorage.getItem('code_verifier'),
        }),
    })
    .then(response => response.json())
    .then(data => {
        console.log("Got token from user auth", data);
        cacheUserAuthData(data);
        return data['access_token'];
    });
}

const shouldPromptForUserAuth = (userAuthData, scopes) => {
    if (!userAuthData) {
        console.log('No token found');
        return true;
    } else if (!isSubsetOf(userAuthData['scope'], scopes)) {
        console.log('New scopes requested');
        return true;
    }
    return false;
}

function shouldRenewToken(userAuthData) {
    const now = new Date().getTime();
    return userAuthData['expiresAt'] < now;
}

function refreshAccessToken(userAuthData) {
    return fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: userAuthData.refresh_token,
            client_id: clientId
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        } else {
            console.log("Refreshed token", data);
            cacheUserAuthData(data);
            return data;
        }
    });
}

function cacheUserAuthData(userAuthData) {
    // properties: access_token, token_type, scope, expires_in, refresh_token
    const now = new Date().getTime();
    userAuthData['expiresAt'] = now + (userAuthData['expires_in'] - expiryBufferInSeconds) * 1000;
    localStorage.setItem(userAuthDataKey, JSON.stringify(userAuthData));
}

export function addSongsToPlaylist(playlistId, songUris, position=undefined) {
    const authScopes = ['playlist-modify-private', 'playlist-modify-public'];
    const songUriBatches = chunkArray(songUris, maxSongsPerAddToPlaylistRequest);
    var songsAdded = 0;
    var requests = [];
    for (const songUriBatch of songUriBatches) {
        const queryParams = `uris=${songUriBatch.join(',')}` + (position !== undefined? `&position=${position + songsAdded}` : '');
        const request = getUserAuth(authScopes).then(authToken =>
            fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?${queryParams}`, {
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
    var queryParams = `seed_genres=${genres.join(',')}&limit=100&`
    queryParams += Object.entries(audioFeatures)
        .map(([key, value]) => `target_${key}=${value}`)
        .join('&');
    return getUserAuth([]).then(token => requestRecommendations(token, queryParams));
}

function requestRecommendations(token, queryParams) {
    // e.g. target_popularity=100&target_energy=80&target_acousticness=80&target_loudness=50&target_instrumentalness=100
    console.log('queryParams', queryParams);
    return fetch(`https://api.spotify.com/v1/recommendations?${queryParams}`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => response.json())
    .catch(error => console.error('Error:', error));
}

function getCurrentUserId() {
    if (userId) {
        return Promise.resolve(userId);
    }
    return getUserAuth(['user-read-private']).then((authToken) =>
        fetch('https://api.spotify.com/v1/me', {
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
        fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${spotifyId}`, {
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
        fetch(`https://api.spotify.com/v1/me/tracks?ids=${spotifyId}`, {
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
        fetch(`https://api.spotify.com/v1/me/tracks`, {
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
        fetch(`https://api.spotify.com/v1/me/player`, {
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
        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
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
        return getUserPlaylistsRecursively(0, maxPlaylistsPerRequest)
            .then((playlists) => playlists.filter(editableByUser));
    }));
}

export function getUserPlaylistsRecursively(offset, limit) {
    return getUserAuth(['playlist-read-private']).then(authToken =>
        fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`, {
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

export function getAlbum(albumUri) {
    return getUserAuth([]).then(authToken =>
        fetch(`https://api.spotify.com/v1/albums/${albumUri}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
        })
    )
    .then(response => response.json());
}