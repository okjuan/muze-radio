# Muze Radio

A web app for discovering music using fine-grained controls.
Deployed at [okjuan.me/muze-radio](https://okjuan.me/muze-radio), but not yet accesible to the public.
(Need to get Spotify's extended quota.)

## development notes

### clear cache token

In devtools, go to `Application > Storage > Local Storage > (URL where app is running e.g. http://localhost:xxxx)` and delete the `userAuthData` and `code_verifier` entries.

### expire cached token
```js
function setTokenExpirationToNow() {
    var userAuthData = JSON.parse(localStorage.getItem('userAuthData'));
    userAuthData['expiresAt'] = new Date().getTime();
    localStorage.setItem('userAuthData', JSON.stringify(userAuthData))
}
```