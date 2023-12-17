var userAuthData = undefined;
var currentlyPlaying = {
    artist: undefined,
    song: undefined,
    album: undefined,
    coverArtUrl: undefined,
    spotifyUri: undefined,
    spotifyId: undefined,
};
var userPlaylists = undefined;
const expiryBufferInSeconds = 60 * 5;
const clientId = 'TODO';
const clientSecret = 'TODO';
const redirectUri = 'http://localhost:5000';
const spotifyMaxPlaylistsPerRequest = 50;
const spotifyMaxSongsPerAddToPlaylistRequest = 100;
const spotifySeedGenres = ["acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues", "bossanova", "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical", "club", "comedy", "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco", "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel", "goth", "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk", "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance", "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc", "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party", "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b", "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly", "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter", "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study", "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music"];
const maxSeedGenres = 5;
const spotifyScopes = ['streaming user-read-private user-read-playback-state user-read-currently-playing user-read-email user-modify-playback-state user-library-read user-library-modify', 'playlist-read-collaborative', 'playlist-read-private', 'playlist-modify-private', 'playlist-modify-public'];
var playlistPickerShowing = false;

const shouldFetchNewToken = (scopes) => {
    if (!userAuthData) {
        console.log('No token found');
        return true;
    } else if (!isSubsetOf(userAuthData['scopes'], scopes)) {
        console.log('New scopes requested');
        return true;
    }
    const now = new Date();
    if (userAuthData['expiresAt'].getTime() < now.getTime()) {
        console.log('Token expired');
        return true;
    }
    console.log('Cached token still good!');
    return false;
}

if (shouldFetchNewToken(spotifyScopes)) {
    if (!window.location.hash) {
        const encodedRedirectUri = encodeURIComponent(redirectUri);
        window.location.href = `https://accounts.spotify.com/authorize?response_type=token&client_id=${clientId}&scope=${encodeURIComponent(spotifyScopes)}&redirect_uri=${encodedRedirectUri}`;
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
    const now = new Date();
    userAuthData['expiresAt'] = new Date(now.getTime() + (userAuthData['expiresIn'] - expiryBufferInSeconds) * 1000);
    userAuthData['scopes'] = spotifyScopes;
    console.log('userAuthData', userAuthData);
}

window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: 'Muze Radio',
      getOAuthToken: cb => { cb(userAuthData['access_token']); }
    });

  player.addListener('ready', ({ device_id }) => {
    console.log('Ready with Device ID', device_id);
    player.device_id = device_id;
    transferPlayback(device_id);
  });

  player.addListener('not_ready', ({ device_id }) => {
    console.log('Device ID has gone offline', device_id);
  });

  player.addListener('initialization_error', ({ message }) => {
    console.error(message);
  });

  player.addListener('authentication_error', ({ message }) => {
      console.error(message);
  });

  player.addListener('account_error', ({ message }) => {
      console.error(message);
  });

  player.addListener('player_state_changed', ({ paused, track_window: { current_track } }) => {
    document.getElementById('play-pause-button').innerHTML = `<i class="fas ${paused? 'fa-play' : 'fa-pause'}"></i>`;
    var currentPlayingUpdated = false;
    if (currentlyPlaying.spotifyId != current_track['id']) {
        currentlyPlaying.spotifyId = current_track['id'];
        currentPlayingUpdated = true;
    }
    if (currentlyPlaying.spotifyUri != current_track['uri']) {
        currentlyPlaying.spotifyUri = current_track['uri'];
        currentPlayingUpdated = true;
    }
    if (currentlyPlaying.artist != current_track['artists'][0]['name']) {
        currentlyPlaying.artist = current_track['artists'][0]['name'];
        document.getElementById('artist-name-text').textContent = ` ${currentlyPlaying.artist}`;
        currentPlayingUpdated = true;
    }
    if (currentlyPlaying.song != current_track['name']) {
        currentlyPlaying.song = current_track['name'];
        document.getElementById('song-name-text').textContent = ` ${currentlyPlaying.song}`;
        currentPlayingUpdated = true;
    }
    if (currentlyPlaying.coverArtUrl != current_track['album']['images'][0]['url']) {
        currentlyPlaying.coverArtUrl = current_track['album']['images'][0]['url'];
        document.getElementById('cover-art').src = currentlyPlaying.coverArtUrl;
        currentPlayingUpdated = true;
    }
    if (currentlyPlaying.album != current_track['album']['name']) {
        currentlyPlaying.album = current_track['album']['name'];
        document.getElementById('album-name-text').textContent = ` ${currentlyPlaying.album}`;
        currentPlayingUpdated = true;
    }
    if (currentPlayingUpdated) {
        document.getElementById('currently-playing').style.display = 'flex';
        isSavedToLikedSongs(currentlyPlaying.spotifyId).then(response => {
            document.getElementById('like-button').innerHTML = `<i class="${response[0]? 'fa-solid fa-heart' : 'fa-regular fa-heart'}"></i>`
        });
    }
  });

  player.connect();

  const generateRecommendationsButton = document.getElementById('recommendations-button');
  generateRecommendationsButton.disabled = true;
  generateRecommendationsButton.onclick = function() {
    document.getElementById('recommendations-button').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`
    this.disabled = true;
    const audioFeatures = getSpotifyAudioFeatures();
    console.log('audioFeatures', audioFeatures);
    const genres = getSeedGenres(maxSeedGenres);
    console.log('genres', genres);
    getRecommendations(audioFeatures, genres).then(recommendations => {
        console.log('recommendations', recommendations);
        playSongs(player.device_id, shuffleArray(recommendations['tracks'].map(track => track.uri)));
        document.getElementById('recommendations-button').innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Search`;
    });
    this.disabled = false;
  };
  generateRecommendationsButton.disabled = false;

  const playPauseButton = document.getElementById('play-pause-button');
  playPauseButton.disabled = true;
  playPauseButton.onclick = function() {
    player.togglePlay();
  };
  playPauseButton.disabled = false;

  const skipButton = document.getElementById('next-button');
  skipButton.disabled = true;
  skipButton.onclick = function() {
      player.nextTrack();
  };
  skipButton.disabled = false;

  const previousButton = document.getElementById('previous-button');
  previousButton.disabled = true;
  previousButton.onclick = function() {
      player.previousTrack();
  };
  previousButton.disabled = false;

  const likeButton = document.getElementById('like-button');
  likeButton.disabled = true;
  likeButton.onclick = function() {
    document.getElementById('like-button').innerHTML = `<i class="fa-spinner fa-spin"></i>`;
    isSavedToLikedSongs(currentlyPlaying.spotifyId).then(response => {
        const isSavedToLikedSongs = response[0];
        if (isSavedToLikedSongs) {
            removeFromLikedSongs(currentlyPlaying.spotifyId).then(() => {
                document.getElementById('like-button').innerHTML = `<i class="fa-regular fa-heart"></i>`;
            });
        } else {
            saveToLikedSongs(currentlyPlaying.spotifyId).then(() => {
                document.getElementById('like-button').innerHTML = `<i class="fa-solid fa-heart"></i>`;
            });
        }
    }).catch(() => {
        document.getElementById('like-button').innerHTML = `<i class="fa-regular fa-heart"></i>`
    });
  };
  likeButton.disabled = false;

  const plusButton = document.getElementById('add-button');
  plusButton.disabled = true;
  plusButton.onclick = function() {
        const addIcon = document.getElementById('add-button-icon');
        addIcon.className = "fa-solid fa-spinner fa-spin";
        getUserPlaylists().then(playlists => {
            addIcon.className = "fa-solid fa-plus";
            showPlaylistPicker(playlists);
        }).catch(() => {
            addIcon.className = "fa-solid fa-plus";
        });
    };
  plusButton.disabled = false;
};

document.addEventListener('keyup', function onDocumentKeyUp(event) {
    const playlistListModal = document.getElementById('playlist-list-container');
    if (playlistListModal && event.key === 'Escape') {
        playlistListModal.style.display = 'none';
        playlistPickerShowing = false;
    }
});

document.addEventListener('click', function(event) {
    if (!playlistPickerShowing) {
        return;
    }
    const playlistListModal = document.getElementById('playlist-list-container');
    const playlistList = document.getElementById('playlist-list');
    const addButton = document.getElementById('add-button');
    const playlistListClicked = playlistList.contains(event.target) || playlistList === event.target;
    const addButtonClicked = addButton.contains(event.target) || addButton === event.target;
    if (playlistListModal && !playlistListClicked && !addButtonClicked) {
        playlistListModal.style.display = 'none';
        playlistPickerShowing = false;
    }
});

function isSubsetOf(arr1, arr2) {
    return arr2.every(arr2Item => arr1.includes(arr2Item));
}

function getUserPlaylists() {
    if (userPlaylists) {
        return Promise.resolve(userPlaylists);
    }
    return (userAuthData.getUserId()).then(userId => {
        const editableByUser = (playlist) =>
            userId === playlist.owner.id || playlist.collaborative;
        return getUserPlaylistsRecursively(0, spotifyMaxPlaylistsPerRequest)
            .then((playlists) => playlists.filter(editableByUser));
    });
}

function getUserPlaylistsRecursively(offset, limit) {
    return fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAuthData['access_token']}`
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

function showPlaylistPicker(playlists) {
    const playlistListElement = document.getElementById('playlist-list');
    const existingPlaylists = Array.from(
        playlistListElement.querySelectorAll('.playlist-list-item'));
    const existingPlaylistIds = existingPlaylists
        .map(playlistElement => playlistElement.dataset.playlistId);
    const newPlaylists = playlists
        .filter(playlist => !existingPlaylistIds.includes(playlist['id']))
        .map(playlist => {
            const playlistListItem = document.createElement('p');
            let isClickEnabled = true;
            playlistListItem.onclick = (event) => {
                if (!isClickEnabled) {
                    return;
                }
                isClickEnabled = false;
                event.target.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`
                addSongsToPlaylist(playlist['id'], [currentlyPlaying.spotifyUri], 0)
                .then(() => {
                    event.target.innerHTML = playlist.name;
                    isClickEnabled = true;
                });
            };
            playlistListItem.className = 'playlist-list-item';
            playlistListItem.textContent = playlist.name;
            playlistListItem.dataset.playlistId = playlist['id'];
            return playlistListItem;
        });
    playlistListElement.append(...newPlaylists);
    const playlistListModal = document.getElementById('playlist-list-container');
    playlistListModal.style.display = 'block';
    playlistPickerShowing = true;
}

function addSongsToPlaylist(playlistId, songUris, position=undefined) {
    const songUriBatches = chunkArray(songUris, spotifyMaxSongsPerAddToPlaylistRequest);
    var songsAdded = 0;
    var requests = [];
    for (const songUriBatch of songUriBatches) {
        const queryParams = `uris=${songUriBatch.join(',')}` + (position !== undefined? `&position=${position + songsAdded}` : '');
        const request = fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?${queryParams}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userAuthData['access_token']}`
            },
        }).then(response => response.json());
        requests.push(request);
        songsAdded += songUriBatch.length;
    }
    return Promise.all(requests);
}

function chunkArray(array, chunkSize) {
    let chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

const genresContainer = document.querySelector('.pills-container');
spotifySeedGenres.forEach(genre => {
    if (!genresContainer.querySelector(`input[value="${genre}"]`)) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = genre;
        checkbox.className = 'genre';
        checkbox.value = genre;

        // Create label
        const label = document.createElement('label');
        label.htmlFor = genre;
        label.className = 'pill';
        label.textContent = genre.charAt(0).toUpperCase() + genre.slice(1); // Capitalize genre

        genresContainer.appendChild(checkbox);
        genresContainer.appendChild(label);
    }
});

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function isSavedToLikedSongs(spotifyId) {
    return fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${spotifyId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAuthData['access_token']}`
        },
    })
    .then((response) => response.json())
    .then((responseJson) => {
        return responseJson;
    });
}

function removeFromLikedSongs(spotifyId) {
    return fetch(`https://api.spotify.com/v1/me/tracks?ids=${spotifyId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAuthData['access_token']}`
        },
    });
}

function saveToLikedSongs(spotifyId) {
    return fetch(`https://api.spotify.com/v1/me/tracks`, {
        method: 'PUT',
        body: JSON.stringify({ ids: [spotifyId]}),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAuthData['access_token']}`
        },
    });
}

function transferPlayback(device_id) {
    return fetch(`https://api.spotify.com/v1/me/player`, {
        method: 'PUT',
        body: JSON.stringify({ device_ids: [device_id], play: true}),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAuthData['access_token']}`
        },
    })
}

function playSongs(device_id, spotify_uris) {
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: spotify_uris }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAuthData['access_token']}`
        },
    });
}

function getSpotifyAudioFeatures() {
    var sliders = document.getElementsByClassName('slider');
    var sliderValues = Array.from(sliders).map(slider => ({ [slider.name]: slider.value }));
    return Object.assign({}, ...sliderValues);
}

function getSeedGenres(count) {
    const selectedGenres = getSelectedGenres().filter(a => spotifySeedGenres.some(b => a.toLowerCase().trim() === b.toLowerCase().trim()));
    var seedGenres;
    if (selectedGenres.length > 0) {
        seedGenres = selectedGenres.slice(0, count);
    } else {
        var shuffledspotifySeedGenres = spotifySeedGenres.sort(() => 0.5 - Math.random());
        seedGenres = shuffledspotifySeedGenres.slice(0, count);
    }
    return seedGenres;
}

function getSelectedGenres() {
    var genres = document.getElementsByClassName('genre');
    var selectedGenres = Array.from(genres).filter(genre => genre.checked).map(genre => genre.value);
    return selectedGenres;
}

function getRecommendations(audioFeatures, genres) {
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
    return fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': 'Bearer ' + userAuthData['access_token']
        }
    })
    .then(response => response.json())
    .then(data => data.id)
    .catch(error => console.error('Error:', error));
}