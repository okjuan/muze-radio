import { chunkArray, isSubsetOf } from './utils.js';

export const clientId = '';
const clientSecret = '';
export const spotifySeedGenres = ["acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues", "bossanova", "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical", "club", "comedy", "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco", "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel", "goth", "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk", "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance", "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc", "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party", "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b", "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly", "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter", "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study", "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music"];
export const maxPlaylistsPerRequest = 50;
const maxSongsPerAddToPlaylistRequest = 100;
export const maxSeedGenres = 5;
var userPlaylists = undefined;
var userId = undefined;
const userAuthDataKey = "userAuthData";
const expiryBufferInSeconds = 5;
const redirectUri = 'http://localhost:5000';

export function getUserAuth(spotifyScopes) {
    var userAuthData = JSON.parse(localStorage.getItem(userAuthDataKey));
    if (shouldFetchNewToken(userAuthData, spotifyScopes)) {
        if (!window.location.hash) {
            const encodedRedirectUri = encodeURIComponent(redirectUri);
            window.location.href = `https://accounts.spotify.com/authorize?response_type=token&client_id=${clientId}&scope=${encodeURIComponent(spotifyScopes)}&redirect_uri=${encodedRedirectUri}`;
            return undefined;
        }

        userAuthData = window.location.hash
        .substring(1) // remove the '#'
        .split('&') // split into key=value pairs
        .reduce(function(initial, item) {
            if (item) {
            var parts = item.split('=');
            initial[parts[0]] = decodeURIComponent(parts[1]);
            }
            return initial;
        }, {});
        window.history.replaceState(null, null, ' ');
        const now = new Date().getTime();
        userAuthData['expiresAt'] = now + (userAuthData['expires_in'] - expiryBufferInSeconds) * 1000;
        userAuthData['scope'] = spotifyScopes;
        console.log('userAuthData', userAuthData);
        localStorage.setItem(userAuthDataKey, JSON.stringify(userAuthData));
        return userAuthData['access_token'];
    }
    return userAuthData['access_token'];
}

const shouldFetchNewToken = (userAuthData, scopes) => {
    if (!userAuthData) {
        console.log('No token found');
        return true;
    } else if (!isSubsetOf(userAuthData['scope'], scopes)) {
        console.log('New scopes requested');
        return true;
    }
    const now = new Date().getTime();
    if (userAuthData['expiresAt'] < now) {
        console.log('Token expired');
        return true;
    }
    console.log('Cached token still good!');
    return false;
}

export function addSongsToPlaylist(playlistId, songUris, position=undefined) {
    const authScopes = ['playlist-modify-private', 'playlist-modify-public'];
    const songUriBatches = chunkArray(songUris, maxSongsPerAddToPlaylistRequest);
    var songsAdded = 0;
    var requests = [];
    for (const songUriBatch of songUriBatches) {
        const queryParams = `uris=${songUriBatch.join(',')}` + (position !== undefined? `&position=${position + songsAdded}` : '');
        const request = fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?${queryParams}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getUserAuth(authScopes)}`
            },
        }).then(response => response.json());
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
    return getSpotifyWebAPIBearerToken().then(token => requestRecommendations(token['access_token'], queryParams));
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

function getSpotifyWebAPIBearerToken() {
    var headers = new Headers();
    headers.append('Content-Type', 'application/x-www-form-urlencoded');
    headers.append('Authorization', 'Basic ' + btoa(clientId + ':' + clientSecret));

    var body = new URLSearchParams();
    body.append('grant_type', 'client_credentials');

    return fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: headers,
        body: body
    })
    .then(response => response.json())
    .catch(error => console.error('Error:', error));
}

function getCurrentUserId() {
    if (userId) {
        return Promise.resolve(userId);
    }
    return fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': 'Bearer ' + getUserAuth(['user-read-private'])
        }
    })
    .then(response => response.json())
    .then(data => (userId = data.id))
    .catch(error => console.error('Error:', error));
}

export function isSavedToLikedSongs(spotifyId) {
    return fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${spotifyId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getUserAuth(['user-library-read'])}`
        },
    })
    .then((response) => response.json())
    .then((responseJson) => {
        return responseJson;
    });
}

export function removeFromLikedSongs(spotifyId) {
    return fetch(`https://api.spotify.com/v1/me/tracks?ids=${spotifyId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getUserAuth(['user-library-read'])}`
        },
    });
}

export function saveToLikedSongs(spotifyId) {
    return fetch(`https://api.spotify.com/v1/me/tracks`, {
        method: 'PUT',
        body: JSON.stringify({ ids: [spotifyId]}),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getUserAuth(['user-library-read'])}`
        },
    });
}

export function transferPlayback(device_id) {
    return fetch(`https://api.spotify.com/v1/me/player`, {
        method: 'PUT',
        body: JSON.stringify({ device_ids: [device_id], play: true}),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getUserAuth(['user-modify-playback-state'])}`
        },
    })
}

export function playSongs(device_id, spotify_uris) {
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: spotify_uris }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getUserAuth(['user-modify-playback-state'])}`
        },
    });
}

export function getUserPlaylists() {
    if (userPlaylists) {
        return Promise.resolve(userPlaylists);
    }
    return getCurrentUserId().then(userId => {
        const editableByUser = (playlist) =>
            userId === playlist.owner.id || playlist.collaborative;
        return getUserPlaylistsRecursively(0, maxPlaylistsPerRequest)
            .then((playlists) => playlists.filter(editableByUser));
    });
}

export function getUserPlaylistsRecursively(offset, limit) {
    return fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getUserAuth(['playlist-read-private'])}`
        },
    })
    .then(response => response.json())
    .then(data => {
        if (data.items.length === limit) {
            return getUserPlaylistsRecursively(offset + limit, limit)
                .then(nextItems => data.items.concat(nextItems));
        } else {
            return (userPlaylists = data.items);
        }
    });
}