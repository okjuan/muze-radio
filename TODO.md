high pri:
- [ ] support filtering/searching of playlists in modal that appears when '+' (add to playlist) button clicked
- [ ] add song progress bar to allow user to jump to arbitrary position in currently playing track

feature work: sliders
- [ ] replace sliders with sliders with two controls that allow setting a range
    - this will probably require a bit of work; see [this StackOverflow Q](https://stackoverflow.com/q/4753946)
    - see [nouislider](https://refreshless.com/nouislider/ have 2 knobs on sliders to allow custom range

---

backlog:
- [ ] [bug] when there are no songs "next", current song shows up as next in queue
- [ ] [craft] vertically center checkboxes next to each slider label
- [ ] [optimization] fetch audio features of all recommended songs at the same time and save them for use when they are played
- [ ] [craft] disable (or debounce?) player control buttons after one is clicked, until corresponding operation (e.g. skip) completes
- [ ] remove token from local storage if it's expired or absent or bad
- [ ] [optimization] parallelize requests to fetch all user's playlists
- [ ] [optimization] check for OPTIONS requests and remove them as (e.g. `application/json` request(?) types cause them)
- [ ] support multiple cached access tokens at once with different scopes
- [ ] fix layout which got messed up by my adding heart and plus buttons, which leak out of `currently-playing-right` div
- add to playlist:
    - [ ] **interesting**: consider having playlist modal open all the time as a side-view
- [ ] use Spotify's Get User's Top Items API to personalize recommendations
- [ ] give info about how many attributes selected at the top of the pills (so user doesn't have to scroll down and count)
- [ ] fix placement of playlist list modal in mobile
- [ ] use events throughout to handle work e.g. raise event when currently playing has changed, listen to it to update view + controls
- [ ] specify values for Spotify's other audio feature values
    - [ ] (multiple can be derived from a single user input e.g. instrumentalness and speechiness?)
    - [ ] liveness
    - [ ] time signature
    - [ ] covers (is that possible?)
- [ ] let user choose one of their playlists as a seed
    - Ben Schaap asked for this, too!
- [ ] show list of songs in queue
- [ ] add ban button ("don't play this song again")
- [ ] add song progress bar that user can drag to skip
- [ ] disable recommendations button until user makes a change to config (keep track of config state)
- [ ] allow user to specify language
- [ ] allow user to specify date of release
- [ ] show release date of currently playing song
- [ ] limit max selected genres to 5 (see Spotify's seed_genres in https://developer.spotify.com/documentation/web-api/reference/get-recommendations)
- [ ] in `getRecommendations`: throw error if genres is empty or greater than 5 in length