const spotifyGenres = ["acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues", "bossanova", "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical", "club", "comedy", "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco", "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel", "goth", "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk", "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance", "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc", "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party", "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b", "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly", "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter", "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study", "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music"];
const maxSeedGenres = 5;
var playerPaused = true;

window.onSpotifyWebPlaybackSDKReady = () => {
    const token = '[My access token]';
    const player = new Spotify.Player({
      name: 'Web Playback SDK Quick Start Player',
      getOAuthToken: cb => { cb(token); },
      volume: 0.5
    });

  player.addListener('ready', ({ device_id }) => {
    console.log('Ready with Device ID', device_id);
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

  player.connect();

  document.getElementById('play-pause-button').onclick = function() {
    if (playerPaused) {
        const audioFeatures = getSpotifyAudioFeatures();
        console.log('audioFeatures', audioFeatures);
        const genres = getSeedGenres(maxSeedGenres);
        console.log('genres', genres);
        const recommendations = getRecommendations(audioFeatures, genres).then(recommendations => {
            console.log('recommendations', recommendations);
            setPlayerQueue(recommendations['tracks'], player);
            player.togglePlay();
            updatePlayPauseButton();
            playerPaused = false;
        });
    } else {
        player.togglePlay();
        updatePlayPauseButton();
        playerPaused = true;
    }
  };
};

var sliders = document.getElementsByClassName('slider');
for (var i = 0; i < sliders.length; i++) {
    sliders[i].oninput = function() {
            document.getElementById(this.id).textContent = this.value;
            console.log(this.id + ' value: ' + this.value);
    }
    // Trigger the event manually to display the initial value
    sliders[i].oninput();
}

function updatePlayPauseButton() {
    console.log("play/pause button clicked");
    var playPauseButton = document.getElementById('play-pause-button');
    const playPauseButtonState = playPauseButton.textContent.trim();
    if (playPauseButtonState === 'Play') {
        playPauseButton.textContent = 'Pause';
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i> Pause';
    } else {
        playPauseButton.textContent = 'Play';
        playPauseButton.innerHTML = '<i class="fas fa-play"></i> Play';
    }
};

function getSpotifyAudioFeatures() {
    var sliders = document.getElementsByClassName('slider');
    var sliderValues = Array.from(sliders).map(slider => ({ [slider.name]: slider.value }));
    return Object.assign({}, ...sliderValues);
}

function getSeedGenres(count) {
    const selectedGenres = getSelectedGenres();
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
    // TODO: throw error if genres is empty or greater than 5 in length

    var queryParams = `seed_genres=${genres.join(',')}&`;
    queryParams += Object.entries(audioFeatures)
        .map(([key, value]) => `target_${key}=${value}`)
        .join('&');
    return getBearerToken().then(token => requestRecommendations(token['access_token'], queryParams));
}

function requestRecommendations(token, queryParams) {
    console.log('token', token);
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

function getBearerToken() {
    var clientId = 'your-client-id'; // Replace with your client ID
    var clientSecret = 'your-client-secret'; // Replace with your client secret

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

function setPlayerQueue(tracks, player) {
    const uris = tracks.map(track => track.uri);
    console.log("uris", uris);

    // TODO: figure out how to clear queue and set new queue

    // player.clearQueue(); <== this is not a function
    //player.queue({ uris })  <== this is not a function
    //.then(() => {
    //    console.log('Track queued!');
    //});
}