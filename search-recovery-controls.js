'use strict';

(function exposeSearchRecovery(root, factory) {
  const controls = factory();
  if (typeof module === 'object' && module.exports) module.exports = controls;
  if (root) root.SuggestDishSearchRecovery = controls;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const DISTANCE_OPTIONS_KM = Object.freeze([1, 2, 5, 10, 25, 50]);

  function normaliseDistance(value) {
    const distance = Number(value);
    return Number.isFinite(distance) ? distance : 5;
  }

  function nextDistance(value) {
    const current = normaliseDistance(value);
    return DISTANCE_OPTIONS_KM.find(distance => distance > current) ?? null;
  }

  function previousDistance(value) {
    const current = normaliseDistance(value);
    return DISTANCE_OPTIONS_KM.filter(distance => distance < current).pop() ?? null;
  }

  function emptyRecoveryState(hasCoordinates, value) {
    if (!hasCoordinates) {
      return Object.freeze({
        hideDistanceAction: true,
        disableDistanceAction: false,
        distanceActionLabel: 'Increase distance',
        message: 'Distance does not apply to this city-wide search. Edit your request or choose a precise locality or GPS location.'
      });
    }

    const atMaximum = nextDistance(value) === null;
    return Object.freeze({
      hideDistanceAction: false,
      disableDistanceAction: atMaximum,
      distanceActionLabel: atMaximum ? 'Maximum distance selected' : 'Increase distance',
      message: atMaximum
        ? 'The maximum 50 km distance is already selected. Edit your request to try another match.'
        : 'You can increase the distance without changing your dietary preference or specific dish request.'
    });
  }

  return Object.freeze({DISTANCE_OPTIONS_KM, nextDistance, previousDistance, emptyRecoveryState});
});
