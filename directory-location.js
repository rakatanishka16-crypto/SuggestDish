document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('businessDirectoryForm');
  if (!form) return;
  let origin = null;
  window.SuggestDishDirectoryLocation = {get: () => origin};
  const controls = document.createElement('div');
  const locate = document.createElement('button'); locate.type = 'button'; locate.className = 'btn btn-light'; locate.textContent = 'Use my location for distances';
  const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'btn btn-light'; clear.textContent = 'Clear distance location'; clear.hidden = true;
  const status = document.createElement('p'); status.className = 'small mute'; status.setAttribute('role','status');
  status.textContent = 'Allow browser location to see straight-line distances where outlet coordinates are available.';
  controls.append(locate,clear,status); form.append(controls);
  locate.addEventListener('click', () => {
    if (!navigator.geolocation) {status.textContent = 'Location is unavailable in this browser.'; return;}
    origin = null; clear.hidden = true;
    locate.disabled = true; status.textContent = 'Waiting for browser location permission…';
    navigator.geolocation.getCurrentPosition(position => {
      origin = {lat:position.coords.latitude,lon:position.coords.longitude};
      locate.disabled = false; clear.hidden = false;
      status.textContent = 'Location selected. Search businesses again to calculate straight-line distances. Map coordinates and browser accuracy may vary.';
    }, () => {locate.disabled = false;status.textContent = 'Location was not available. You can continue searching by city or locality.';}, {timeout:10000,maximumAge:60000,enableHighAccuracy:false});
  });
  clear.addEventListener('click', () => {origin = null;clear.hidden = true;status.textContent = 'Distance location cleared. Search again to refresh results.';});
});
