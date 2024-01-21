import {
    addSongsToPlaylist,
    getAlbum,
    getArtists,
    getIdFromUri,
    getSong,
    getSpotifyAudioFeatures,
    getRecommendations,
    getUserAuth,
    getUserPlaylists,
    isSavedToLikedSongs,
    maxSeedGenres,
    playSongs,
    removeFromLikedSongs,
    saveToLikedSongs,
    getSpotifySeedGenres,
    transferPlayback
} from './spotify.js';
import { arraysAreEqual, calculatePercentage, shuffleArray } from './utils.js';
import { isFirstTimeUser } from './cache.js';

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
var HAS_USER_CLICKED_FIND_MUSIC = false;
let RESOLVE_PLAYER_DEVICE_ID = undefined;

// immediately start auth process, which may require us to prompt user for permission
// or to request refresh of token in the background
getUserAuth(SPOTIFY_SCOPES);

window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
        name: 'Muze Radio',
        getOAuthToken: cb => { cb(getUserAuth(SPOTIFY_SCOPES)); }
    });

    player.getDeviceId = new Promise((resolve) => {
        RESOLVE_PLAYER_DEVICE_ID = resolve;
    });

    player.addListener('ready', onPlayerReady);

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

    player.addListener('player_state_changed', onPlayerStateChanged);

    player.connect();

    setUpRecommendationsButtonListener(player);
    setUpPlayerControlButtons(player);
};

const onPlayerReady = ({ device_id }) => {
    console.log('Ready with Device ID', device_id);
    RESOLVE_PLAYER_DEVICE_ID(device_id);
    transferPlayback(device_id).then(() => {
        enablePlayerButtons();
        setTimeout(() => {
            if (!HAS_USER_CLICKED_FIND_MUSIC && isFirstTimeUser()) {
                showMessageToUser("Click 'Find Music' to start exploring!");
            }
        }, 5000);
        setTimeout(() => {
            if (!HAS_USER_CLICKED_FIND_MUSIC) {
                showMessageToUser("Click 'Find Music' to start exploring!");
            }
        }, 15000);
        console.debug("Pre-fetching user's playlists...");
        getUserPlaylists().then(() => console.debug("Done fetching user's playlists!"));
    });
}

const onPlayerStateChanged = (args) => {
    if (args === null || args === undefined) {
        console.debug('player_state_changed event triggered but args is null or undefined -- returning early from handler');
        return;
    }
    const { paused, track_window: { current_track } } = args;
    document.getElementById('play-pause-button-icon').className = `fas ${paused? 'fa-play' : 'fa-pause'}`;
    if (!current_track) {
        return;
    }
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
        updateCurrentlyPlayingSong(current_track);
        currentPlayingUpdated = true;
    }
    if (CURRENTLY_PLAYING.albumUri != current_track['album']['uri']) {
        updateCurrentlyPlayingAlbum(current_track);
        currentPlayingUpdated = true;
    }
    if (currentPlayingUpdated) {
        isSavedToLikedSongs(CURRENTLY_PLAYING.spotifyId).then(response => {
            document.getElementById('like-button-icon').className = `${response[0]? 'fa-solid fa-heart' : 'fa-regular fa-heart'}`
        });
        updateCurrentlyPlayingAudioFeatures(current_track);
    }
}

const setUpRecommendationsButtonListener = (player) => {
    const generateRecommendationsButton = document.getElementById('recommendations-button');
    generateRecommendationsButton.disabled = true;
    generateRecommendationsButton.onclick = function() {
        HAS_USER_CLICKED_FIND_MUSIC = true;
        document.getElementById('recommendations-button-icon').className = "fa-solid fa-spinner fa-spin";
        this.disabled = true;
        const audioFeatures = getSpotifyAudioFeatureRanges();
        console.debug('audioFeatures', audioFeatures);
        getSeedGenres(maxSeedGenres).then(genres => {
            console.debug('genres', genres);
            requestRecommendationsUntilFound(audioFeatures, genres).then(recommendations => {
                console.debug('recommendations', recommendations);
                if (recommendations.tracks.length > 0) {
                    player.getDeviceId.then(device_id => {
                        playSongs(device_id, shuffleArray(recommendations['tracks'].map(track => track.uri)));
                        document.getElementById('recommendations-button-icon').className = "fa-solid fa-magnifying-glass";
                    });
                }
            });
            this.disabled = false;
        }).catch((_) => {
            this.disabled = false;
        });
    }
}

const setUpPlayerControlButtons = (player) => {
    const playPauseButton = document.getElementById('play-pause-button');
    playPauseButton.onclick = function() {
        player.togglePlay();
    };

    const skipButton = document.getElementById('next-button');
    skipButton.onclick = function() {
        player.nextTrack();
    };

    const previousButton = document.getElementById('previous-button');
    previousButton.onclick = function() {
        player.previousTrack();
    };
    setUpLikeButton();
    setUpAddToPlaylistButton();
}

const setUpLikeButton = () => {
    const likeButton = document.getElementById('like-button');
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
            console.error("Error occurred when handling button click on like button:" + error);
            likeButtonIcon.className = "fa-regular fa-heart";
            showMessageToUser("Sorry, that didn't work. Please try again later.");
        });
    };
}

const setUpAddToPlaylistButton = () => {
    const plusButton = document.getElementById('add-button');
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
}

function enablePlayerButtons() {
    document.getElementById('recommendations-button').disabled = false;
    document.getElementById('play-pause-button').disabled = false;
    document.getElementById('next-button').disabled = false;
    document.getElementById('previous-button').disabled = false;
    document.getElementById('like-button').disabled = false;
    document.getElementById('add-button').disabled = false;
}

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
        console.debug("Retrying getArtists() since it failed the first time: " + error);
        setTimeout(() => {
            getArtists(artistIds)
            .then(artists => addSpotifyLinksToArtistNames(artists))
            .catch((error) => {
                console.error("Error occurred on retry of fetching artists: " + error);
            });
        }, 1000);
    });
}

function updateCurrentlyPlayingSong(current_track) {
    CURRENTLY_PLAYING.songName = current_track['name'];
    CURRENTLY_PLAYING.songUri = current_track['uri'];
    const songNameElement = document.getElementById('song-name-text');
    songNameElement.textContent = ` ${current_track['name']}`;
    getSong(current_track['id']).then(song => {
        if (!song) {
            console.debug("Couldn't add link for currently playing song because no song found for track id: " + current_track.id);
            return;
        }
        CURRENTLY_PLAYING.song = song;
        songNameElement.className += " clickable";
        songNameElement.onclick = () => {
            window.open(song.external_urls.spotify, '_blank');
        };
        updateCurrentlyPlayingSliderInputIcon('popularity', song.popularity);
    }).catch((error) => {
        console.error("Error occurred when fetching song: " + error);
        document.querySelectorAll('.song-metadata-icon-currently-playing').forEach(icon => icon.style.display = 'none');
    });
}

function updateCurrentlyPlayingAlbum(current_track) {
    CURRENTLY_PLAYING.albumUri = current_track['album']['uri'];
    CURRENTLY_PLAYING.albumName = current_track['album']['name'];
    const albumNameElement = document.getElementById('album-name-text');
    albumNameElement.textContent = ` ${CURRENTLY_PLAYING.albumName}`;

    const coverArtImg = document.getElementById('cover-art');
    setCoverArt(coverArtImg, current_track['album']['images']);

    const albumId = getIdFromUri(CURRENTLY_PLAYING.albumUri);
    getAlbum(albumId).then(album => {
        if (!album) {
            console.debug("Couldn't add link for currently playing album because no album found for id: " + albumId);
            return;
        }
        CURRENTLY_PLAYING.album = album;
        coverArtImg.className += " clickable";
        albumNameElement.className += " clickable";
        coverArtImg.onclick = (albumNameElement.onclick = () => {
            window.open(album.external_urls.spotify, '_blank');
        });
    });
}

function setCoverArt(coverArtImg, coverArtImages) {
    const coverArtSize = coverArtImg.clientWidth;
    const bestMatchImage = coverArtImages.reduce((bestImage, image) => {
        if (!bestImage || Math.abs(image.width - coverArtSize) < Math.abs(bestImage.width - coverArtSize)) {
            return image;
        }
        return bestImage;
    }, null);

    if (bestMatchImage) {
        CURRENTLY_PLAYING.coverArtUrl = bestMatchImage.url;
        coverArtImg.src = CURRENTLY_PLAYING.coverArtUrl;
        coverArtImg.alt = `Cover art for ${CURRENTLY_PLAYING.albumName}`;
    } else {
        console.error("No suitable image found for cover art");
    }
}

function addSpotifyLinksToArtistNames(artists) {
    var delimiter = " ";
    const artistsWithLinks = artists.artists
        .filter(artist => artist !== null && artist !== undefined)
        .map(artist => {
            const artistName = document.createElement('span');
            artistName.textContent = `${delimiter}${artist.name}`;
            artistName.className += " clickable";
            artistName.onclick = () => {
                window.open(artist.external_urls.spotify, '_blank');
            };
            delimiter = ", ";
            return artistName;
        });
    if (artistsWithLinks.length > 0) {
        const artistNameElement = document.getElementById('artist-name-text');
        artistNameElement.textContent = "";
        // TODO: add commas between artists here instead of doing it above
        artistNameElement.append(...artistsWithLinks);
    } else {
        console.debug("Couldn't add links for any artist!");
    }
}

function updateCurrentlyPlayingAudioFeatures(current_track) {
    getSpotifyAudioFeatures([current_track.id]).then((audioFeatures) => {
        if (audioFeatures.length < 1 || !audioFeatures[0]) {
            console.debug("No audio features found for track " + current_track.id);
            document.querySelectorAll('.audio-feature-icon-currently-playing').forEach(icon => icon.style.display = 'none');
            return;
        }
        Object.entries(audioFeatures[0]).forEach(([audioFeature, value]) =>
            updateCurrentlyPlayingSliderInputIcon(audioFeature, value)
        );
    });
}

function updateCurrentlyPlayingSliderInputIcon(inputName, value) {
    const inputElement = document.getElementById(`${inputName}-input`);
    if (inputElement === null) {
        console.debug(`No input found for '${inputName}'`);
        return;
    }
    const valuePercentage = calculatePercentage(value, inputElement.min, inputElement.max);
    console.debug(`${inputName}: val=${value}, max=${inputElement.max}, min=${inputElement.min} percent=${valuePercentage}`);
    const iconElement = document.getElementById(`${inputName}-currently-playing-icon`);
    iconElement.style.left = `${valuePercentage}%`;
    iconElement.style.display = 'inline';
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

function requestRecommendationsUntilFound(audioFeatures, genres) {
    return getRecommendations(audioFeatures, genres).then(recommendations => {
        if (recommendations.tracks.length === 0) {
            var atLeastOneAudioFeatureLoosened = false;
            const loosenedAudioFeatures = Object.assign({}, ...Object.entries(audioFeatures).map(([audioFeature, parameters]) => {
                if (parameters.minValue > parameters.lowerBound || parameters.maxValue < parameters.upperBound) {
                    atLeastOneAudioFeatureLoosened = true;
                }
                return {
                    [audioFeature]: {
                        minValue: Math.max(parameters.minValue - (parameters.step), parameters.lowerBound),
                        maxValue: Math.min(parameters.maxValue + (parameters.step), parameters.upperBound),
                        step: parameters.step,
                        lowerBound: parameters.lowerBound,
                        upperBound: parameters.upperBound,
                    }
                };
            }));
            if (!atLeastOneAudioFeatureLoosened) {
                showMessageToUser("Sorry, no Spotify recommendations are available for your contraints. Please try again with different constraints.");
                return { recommendations: { tracks: [] } };
            }
            return requestRecommendationsUntilFound(loosenedAudioFeatures, genres);
        }
        showMessageToUser(`Found ${recommendations.tracks.length} recommendations!`);
        return recommendations;
    });
}

const genresContainer = document.querySelector('.pills-container');
getSpotifySeedGenres().then(genres => {
    genres.forEach((genre, index) => {
        if (!genresContainer.querySelector(`input[value="${genre}"]`)) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = genre;
            checkbox.className = 'genre';
            checkbox.value = genre;
            checkbox.checked = index === 0;

            const label = document.createElement('label');
            label.htmlFor = genre;
            label.className = 'pill';
            label.textContent = genre.charAt(0).toUpperCase() + genre.slice(1); // Capitalize genre

            genresContainer.appendChild(checkbox);
            genresContainer.appendChild(label);
        }
    });
});

document.querySelectorAll('.slider-label-container').forEach((sliderLabelContainer, index) => {
    sliderLabelContainer.addEventListener('click', () => {
        const checkbox = sliderLabelContainer.querySelector('.slider-checkbox');
        const slider = document.querySelectorAll('.slider')[index];
        checkbox.className = 'slider-checkbox ' + (slider.disabled? 'fa-solid fa-square-check' : 'fa-regular fa-square');
        slider.disabled = !slider.disabled;
    });
});

function getSpotifyAudioFeatureRanges() {
    var sliders = document.getElementsByClassName('slider');
    var sliderValues = Array.from(sliders)
        .filter((slider) => !slider.disabled)
        .map(slider => {
            const value = Number(slider.value);
            const step = Number(slider.step);
            const min = Number(slider.min);
            const max = Number(slider.max);
            return {
                [slider.name]: {
                    minValue: Math.max(value - (step), min),
                    maxValue: Math.min(value + (step), max),
                    step: step,
                    upperBound: max,
                    lowerBound: min,
                }
            };
        });
    return Object.assign({}, ...sliderValues);
}

function getSeedGenres(count) {
    return getSpotifySeedGenres().then(spotifySeedGenres => {
        const selectedGenres = getSelectedGenres().filter(a => spotifySeedGenres.some(b => a.toLowerCase().trim() === b.toLowerCase().trim()));
        var seedGenres;
        if (selectedGenres.length > 0) {
            seedGenres = selectedGenres.slice(0, count);
        } else {
            var shuffledspotifySeedGenres = spotifySeedGenres.sort(() => 0.5 - Math.random());
            seedGenres = shuffledspotifySeedGenres.slice(0, count);
        }
        return seedGenres;
    });
}

function getSelectedGenres() {
    var genres = document.getElementsByClassName('genre');
    var selectedGenres = Array.from(genres).filter(genre => genre.checked).map(genre => genre.value);
    return selectedGenres;
}