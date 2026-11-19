function renderMarketMap(marketInfo) {
  function coordinate(value, limit) {
    if ((typeof value !== 'string' && typeof value !== 'number')
        || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
  }

  const latitude = coordinate(marketInfo.latitude, 90);
  const longitude = coordinate(marketInfo.longitude, 180);
  if (latitude === null || longitude === null) return '';

  // OpenStreetMap's standard map uses Web Mercator, which cannot display the poles.
  const maxLatitude = 85.05112878;
  if (Math.abs(latitude) > maxLatitude) {
    return '<p class="market-map-message">Map unavailable for these coordinates.</p>';
  }

  const delta = 0.01;
  const bounds = [
    Math.max(-180, longitude - delta),
    Math.max(-maxLatitude, latitude - delta),
    Math.min(180, longitude + delta),
    Math.min(maxLatitude, latitude + delta)
  ].join(',');
  const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bounds}&amp;layer=mapnik&amp;marker=${latitude},${longitude}`;
  return `<div class="market-map">
    <iframe title="Market location map" src="${url}" loading="lazy" referrerpolicy="no-referrer"></iframe>
    <small>Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></small>
  </div>`;
}
