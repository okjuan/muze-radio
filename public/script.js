var userAuthData = undefined;
var currentlyPlaying = {
    artist: undefined,
    song: undefined,
    album: undefined,
    coverArtUrl: undefined
};
const expiryBufferInSeconds = 60 * 5;
const clientId = 'TODO';
const clientSecret = 'TODO';
const redirectUri = 'http://localhost:5000';
const spotifyGenres = ["acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues", "bossanova", "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical", "club", "comedy", "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco", "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel", "goth", "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk", "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance", "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc", "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party", "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b", "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly", "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter", "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study", "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music"];
const maxSeedGenres = 5;

const shouldFetchNewToken = () => {
    if (!userAuthData) {
        console.log('No token found');
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

if (shouldFetchNewToken()) {
    if (!window.location.hash) {
        const encodedRedirectUri = encodeURIComponent(redirectUri);
        const scopes = encodeURIComponent('streaming user-read-private user-read-playback-state user-read-currently-playing user-read-email user-modify-playback-state');
        window.location.href = `https://accounts.spotify.com/authorize?response_type=token&client_id=${clientId}&scope=${scopes}&redirect_uri=${encodedRedirectUri}`;
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
    console.log('userAuthData', userAuthData);
} else {
    console.log("Didn't fetch new token");
}

window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: 'Web Playback SDK Quick Start Player',
      getOAuthToken: cb => { cb(userAuthData['access_token']); }
    });

  player.addListener('ready', ({ device_id }) => {
    console.log('Ready with Device ID', device_id);
    player.device_id = device_id;
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
    updatePlayPauseButton(paused? 'Paused' : 'Playing');
    var currentPlayingUpdated = false;
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
    }
  });

  player.connect();

  const generateRecommendationsButton = document.getElementById('recommendations-button');
  generateRecommendationsButton.disabled = true;
  generateRecommendationsButton.onclick = function() {
    //updatePlayPauseButton('Loading');
    this.disabled = true;
    const audioFeatures = getSpotifyAudioFeatures();
    console.log('audioFeatures', audioFeatures);
    const genres = getSeedGenres(maxSeedGenres);
    console.log('genres', genres);
    getRecommendations(audioFeatures, genres).then(recommendations => {
        console.log('recommendations', recommendations);
        playSongs(player.device_id, recommendations['tracks'].map(track => track.uri));
        //updatePlayPauseButton('Playing');
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
};

const genresContainer = document.querySelector('.pills-container');
spotifyGenres.forEach(genre => {
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

function updatePlayPauseButton(newState) {
    var playPauseButton = document.getElementById('play-pause-button');
    if (newState === 'Playing') {
        playPauseButton.textContent = 'Pause';
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
    } else if (newState === 'Paused') {
        playPauseButton.textContent = 'Play';
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
    } else if (newState === 'Loading') {
        playPauseButton.textContent = 'Loading';
    } else {
        throw new Error('Invalid play/pause button state: ' + newState);
    }
};

function getSpotifyAudioFeatures() {
    var sliders = document.getElementsByClassName('slider');
    var sliderValues = Array.from(sliders).map(slider => ({ [slider.name]: slider.value }));
    return Object.assign({}, ...sliderValues);
}

function getSeedGenres(count) {
    const selectedGenres = getSelectedGenres().filter(a => spotifyGenres.some(b => a.toLowerCase().trim() === b.toLowerCase().trim()));
    var seedGenres;
    if (selectedGenres.length > 0) {
        seedGenres = selectedGenres.slice(0, count);
    } else {
        var shuffledSpotifyGenres = spotifyGenres.sort(() => 0.5 - Math.random());
        seedGenres = shuffledSpotifyGenres.slice(0, count);
    }
    return seedGenres;
}

function getSelectedGenres() {
    var genres = document.getElementsByClassName('genre');
    var selectedGenres = Array.from(genres).filter(genre => genre.checked).map(genre => genre.value);
    return selectedGenres;
}

function getRecommendations(audioFeatures, genres) {
    var queryParams = `seed_genres=${genres.join(',')}&`;
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