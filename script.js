var sliders = document.getElementsByClassName('slider');
for (var i = 0; i < sliders.length; i++) {
    sliders[i].oninput = function() {
            document.getElementById(this.id).textContent = this.value;
            console.log(this.id + ' value: ' + this.value);
    }
    // Trigger the event manually to display the initial value
    sliders[i].oninput();
}

function togglePlayPause() {
    console.log("play/pause button clicked");
    var playPauseButton = document.getElementById('play-pause-button');
    const playPauseButtonState = playPauseButton.textContent.trim();
    if (playPauseButtonState === 'Play') {
        // Play the music
        playPauseButton.textContent = 'Pause';
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i> Pause';
    } else {
        // Pause the music
        playPauseButton.textContent = 'Play';
        playPauseButton.innerHTML = '<i class="fas fa-play"></i> Play';
    }
}