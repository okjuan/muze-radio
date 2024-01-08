import {
    addSongsToPlaylist,
    getAlbum,
    getArtists,
    getIdFromUri,
    getSong,
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
import { arraysAreEqual, shuffleArray } from './utils.js';

var USER_MESSAGE_TIMEOUT_MS = 3000;
var CURRENTLY_PLAYING = {
    artistNames: undefined,
    songName: undefined,
    song: undefined,
    songUri: undefined,
    album: undefined,
    albumUri: undefined,
    albumName: undefined,
    coverArtUrl: undefined,
    spotifyUri: undefined,
    spotifyId: undefined,
};
var PLAYLIST_PICKER_SHOWING = false;
export const SPOTIFY_SCOPES = [
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

getUserAuth(SPOTIFY_SCOPES);

window.onSpotifyWebPlaybackSDKReady = () => {
  const player = new Spotify.Player({
      name: 'Muze Radio',
      getOAuthToken: cb => { cb(getUserAuth(SPOTIFY_SCOPES)); }
  });

  let resolveDeviceId;
  player.getDeviceId = new Promise((resolve) => {
    resolveDeviceId = resolve;
});

  player.addListener('ready', ({ device_id }) => {
    console.log('Ready with Device ID', device_id);
    resolveDeviceId(device_id);
    transferPlayback(device_id).then(() => {
        console.log("Pre-fetching user's playlists...");
        getUserPlaylists().then(() => console.log("Done fetching user's playlists!"));
    });
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

  player.addListener('player_state_changed', (args) => {
    if (args === null || args === undefined) {
        console.log('player_state_changed event triggered but args is null or undefined -- returning early from handler');
        return;
    }
    const { paused, track_window: { current_track } } = args;
    document.getElementById('play-pause-button-icon').className = `fas ${paused? 'fa-play' : 'fa-pause'}`;
    var currentPlayingUpdated = false;
    if (CURRENTLY_PLAYING.spotifyId != current_track['id']) {
        CURRENTLY_PLAYING.spotifyId = current_track['id'];
        currentPlayingUpdated = true;
    }
    if (CURRENTLY_PLAYING.spotifyUri != current_track['uri']) {
        CURRENTLY_PLAYING.spotifyUri = current_track['uri'];
        currentPlayingUpdated = true;
    }
    if (!arraysAreEqual(CURRENTLY_PLAYING.artistUris ?? [], current_track['artists'].map(a => a.uri))) {
        updateCurrentlyPlayingArtists(current_track);
        currentPlayingUpdated = true;
    }
    if (CURRENTLY_PLAYING.songUri != current_track['uri']) {
        CURRENTLY_PLAYING.songName = current_track['name'];
        CURRENTLY_PLAYING.songUri = current_track['uri'];
        const songNameElement = document.getElementById('song-name-text');
        songNameElement.textContent = ` ${current_track['name']}`;
        getSong(current_track['id']).then(song => {
            CURRENTLY_PLAYING.song = song;
            songNameElement.className += " clickable";
            songNameElement.onclick = () => {
                window.open(song.external_urls.spotify, '_blank');
            };
        });
        currentPlayingUpdated = true;
    }
    if (CURRENTLY_PLAYING.albumUri != current_track['album']['uri']) {
        CURRENTLY_PLAYING.albumName = current_track['album']['name'];
        const albumNameElement = document.getElementById('album-name-text');
        albumNameElement.textContent = ` ${CURRENTLY_PLAYING.albumName}`;

        CURRENTLY_PLAYING.coverArtUrl = current_track['album']['images'][0]['url'];
        const coverArtImg = document.getElementById('cover-art')
        coverArtImg.src = CURRENTLY_PLAYING.coverArtUrl;

        const albumId = getIdFromUri(current_track['album']['uri']);
        getAlbum(albumId).then(album => {
            CURRENTLY_PLAYING.album = album;
            coverArtImg.className += " clickable";
            albumNameElement.className += " clickable";
            coverArtImg.onclick = (albumNameElement.onclick = () => {
                window.open(album.external_urls.spotify, '_blank');
            });
        });
        currentPlayingUpdated = true;
    }
    if (currentPlayingUpdated) {
        document.getElementById('currently-playing').style.display = 'flex';
        isSavedToLikedSongs(CURRENTLY_PLAYING.spotifyId).then(response => {
            document.getElementById('like-button-icon').className = `${response[0]? 'fa-solid fa-heart' : 'fa-regular fa-heart'}`
        });
    }
  });

  player.connect();

  const generateRecommendationsButton = document.getElementById('recommendations-button');
  generateRecommendationsButton.disabled = true;
  generateRecommendationsButton.onclick = function() {
    document.getElementById('recommendations-button-icon').className = "fa-solid fa-spinner fa-spin";
    this.disabled = true;
    const audioFeatures = getSpotifyAudioFeatures();
    console.log('audioFeatures', audioFeatures);
    const genres = getSeedGenres(maxSeedGenres);
    console.log('genres', genres);
    getRecommendations(audioFeatures, genres).then(recommendations => {
        console.log('recommendations', recommendations);
        player.getDeviceId.then(device_id => {
            playSongs(device_id, shuffleArray(recommendations['tracks'].map(track => track.uri)));
            document.getElementById('recommendations-button-icon').className = "fa-solid fa-magnifying-glass";
        });
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
  likeButton.onclick = function(event) {
    const likeButtonIcon = event.target.id === "like-button-icon" ? event.target : event.target.querySelector('i');
    likeButtonIcon.className = "fa-solid fa-spinner fa-spin";
    isSavedToLikedSongs(CURRENTLY_PLAYING.spotifyId).then(response => {
        const isSavedToLikedSongs = response[0];
        if (isSavedToLikedSongs) {
            removeFromLikedSongs(CURRENTLY_PLAYING.spotifyId).then(() => {
                likeButtonIcon.className = "fa-regular fa-heart";
                showMessageToUser("Removed from Liked Songs");
            });
        } else {
            saveToLikedSongs(CURRENTLY_PLAYING.spotifyId).then(() => {
                likeButtonIcon.className = "fa-solid fa-heart";
                showMessageToUser("Added to Liked Songs");
            });
        }
    }).catch((error) => {
        console.log("Error occurred when handling button click on like button:" + error);
        likeButtonIcon.className = "fa-regular fa-heart";
        showMessageToUser("Sorry, that didn't work. Please try again later.");
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

function updateCurrentlyPlayingArtists(current_track) {
    CURRENTLY_PLAYING.artistUris = current_track['artists'].map(a => a.uri);
    CURRENTLY_PLAYING.artistNames = current_track['artists']
        .map(artist => artist.name)
        .join(', ');
    const artistNameElement = document.getElementById('artist-name-text');
    artistNameElement.textContent = ` ${CURRENTLY_PLAYING.artistNames}`;
    const artistIds = current_track['artists'].map(a => getIdFromUri(a.uri));
    getArtists(artistIds)
    .then(artists => addSpotifyLinksToArtistNames(artists))
    .catch((error) => {
        console.log("Retrying getArtists() since it failed the first time: " + error);
        setTimeout(() => {
            getArtists(artistIds)
            .then(artists => addSpotifyLinksToArtistNames(artists))
            .catch((error) => {
                console.log("Error occurred on retry of fetching artists: " + error);
            });
        }, 1000);
    });
}

function addSpotifyLinksToArtistNames(artists) {
    const artistNameElement = document.getElementById('artist-name-text');
    artistNameElement.textContent = "";
    var delimiter = " ";
    artists.artists.forEach(artist => {
        const artistName = document.createElement('span');
        artistName.textContent = `${delimiter}${artist.name}`;
        artistName.className += " clickable";
        artistName.onclick = () => {
            window.open(artist.external_urls.spotify, '_blank');
        };
        artistNameElement.appendChild(artistName);
        delimiter = ", ";
    });
}

function showMessageToUser(message) {
    const messageElement = document.getElementById('message-to-user');
    messageElement.textContent = message;
    messageElement.style.opacity = '1';
    setTimeout(() => {
        messageElement.style.opacity = '0';
    }, USER_MESSAGE_TIMEOUT_MS);
}

document.addEventListener('keyup', function onDocumentKeyUp(event) {
    const playlistListModal = document.getElementById('playlist-list-container');
    if (playlistListModal && event.key === 'Escape') {
        playlistListModal.style.display = 'none';
        PLAYLIST_PICKER_SHOWING = false;
    }
});

document.addEventListener('click', function(event) {
    if (!PLAYLIST_PICKER_SHOWING) {
        return;
    }
    const playlistListModal = document.getElementById('playlist-list-container');
    const playlistList = document.getElementById('playlist-list');
    const addButton = document.getElementById('add-button');
    const playlistListClicked = playlistList.contains(event.target) || playlistList === event.target;
    const addButtonClicked = addButton.contains(event.target) || addButton === event.target;
    if (playlistListModal && !playlistListClicked && !addButtonClicked) {
        playlistListModal.style.display = 'none';
        PLAYLIST_PICKER_SHOWING = false;
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
            const playlistListItem = document.createElement('div');
            let isClickEnabled = true;
            playlistListItem.onclick = (event) => {
                if (!isClickEnabled) {
                    return;
                }
                isClickEnabled = false;
                const playlistName = document.getElementById(`playlist-list-item-name-${playlist.id}`);
                playlistName.textContent = "";
                const playlistIcon = document.getElementById(`playlist-list-item-icon-${playlist.id}`);
                playlistIcon.className = "fa-solid fa-spinner fa-spin";
                addSongsToPlaylist(playlist['id'], [CURRENTLY_PLAYING.spotifyUri], 0)
                .then(() => {
                    showMessageToUser(`Track '${CURRENTLY_PLAYING.songName}' added to playlist '${playlist.name}'`);
                    playlistIcon.className = "fa-solid fa-check";
                    setTimeout(() => {
                        playlistName.textContent = playlist.name;
                        playlistIcon.className = "hidden";
                        isClickEnabled = true;
                    }, 1000);
                });
            };
            const playlistName = document.createElement('p');
            playlistName.id = `playlist-list-item-name-${playlist.id}`;
            playlistName.textContent = playlist.name;

            const newPlaylistIcon = document.createElement('i');
            newPlaylistIcon.className = "hidden";
            newPlaylistIcon.id = `playlist-list-item-icon-${playlist.id}`;

            playlistListItem.className = 'playlist-list-item';
            playlistListItem.dataset.playlistId = playlist['id'];

            playlistListItem.append(playlistName, newPlaylistIcon);
            return playlistListItem;
        });
    playlistListElement.append(...newPlaylists);
    const playlistListModal = document.getElementById('playlist-list-container');
    playlistListModal.style.display = 'block';
    PLAYLIST_PICKER_SHOWING = true;
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