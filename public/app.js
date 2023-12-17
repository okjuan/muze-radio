import {
    addSongsToPlaylist,
    getRecommendations,
    getUserAuth,
    getUserPlaylists,
    isSavedToLikedSongs,
    maxSeedGenres,
    playSongs,
    removeFromLikedSongs,
    saveToLikedSongs,
    spotifySeedGenres,
    transferPlayback
} from './spotify.js';
import { shuffleArray } from './utils.js';

var currentlyPlaying = {
    artist: undefined,
    song: undefined,
    album: undefined,
    coverArtUrl: undefined,
    spotifyUri: undefined,
    spotifyId: undefined,
};
var playlistPickerShowing = false;
export const spotifyScopes = [
    'streaming',
    'user-read-private',
    'user-read-playback-state',
    'user-read-currently-playing',
    'user-read-email',
    'user-modify-playback-state',
    'user-library-read',
    'user-library-modify',
    'playlist-read-collaborative',
    'playlist-read-private',
    'playlist-modify-private',
    'playlist-modify-public',
];

getUserAuth(spotifyScopes);

window.onSpotifyWebPlaybackSDKReady = () => {
  const player = new Spotify.Player({
      name: 'Muze Radio',
      getOAuthToken: cb => { cb(getUserAuth(spotifyScopes)); }
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
    document.getElementById('like-button').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
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

function showPlaylistPicker(playlists) {
    const playlistListElement = document.getElementById('playlist-list');
    const existingPlaylists = Array.from(
        playlistListElement.querySelectorAll('.playlist-list-item'));
    const existingPlaylistIds = existingPlaylists
        .map(playlistElement => playlistElement.dataset.playlistId);
    const newPlaylists = playlists
        .filter(playlist => !existingPlaylistIds.includes(playlist['id']))
        .sort((playlist1, playlist2) => playlist1.name.localeCompare(playlist2.name))
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
                    event.target.querySelector('i').className = 'fa-solid fa-check';
                    setTimeout(() => {
                        event.target.innerHTML = playlist.name;
                        isClickEnabled = true;
                    }, 1000);
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

const genresContainer = document.querySelector('.pills-container');
spotifySeedGenres.forEach(genre => {
    if (!genresContainer.querySelector(`input[value="${genre}"]`)) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = genre;
        checkbox.className = 'genre';
        checkbox.value = genre;

        const label = document.createElement('label');
        label.htmlFor = genre;
        label.className = 'pill';
        label.textContent = genre.charAt(0).toUpperCase() + genre.slice(1); // Capitalize genre

        genresContainer.appendChild(checkbox);
        genresContainer.appendChild(label);
    }
});

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