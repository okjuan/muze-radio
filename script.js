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
    player.togglePlay();
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