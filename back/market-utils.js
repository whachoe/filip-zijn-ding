function cleanText(value, maxLength = 255) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function normalizeMarketInfo(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Market information is required');
  }

  let marketId = null;
  if (value.marketId != null && String(value.marketId).trim() !== '') {
    marketId = Number(value.marketId);
    if (!Number.isSafeInteger(marketId) || marketId <= 0) {
      throw new Error('Invalid market ID');
    }
  }

  const marketInfo = {
    marketId,
    marketName: cleanText(value.marketName || value.name),
    localName: cleanText(value.localName),
    country: cleanText(value.country),
    provinceState: cleanText(value.provinceState),
    district: cleanText(value.district),
    cityTownVillage: cleanText(value.cityTownVillage),
    setting: cleanText(value.setting, 100),
    settingOther: cleanText(value.settingOther),
    latitude: normalizeCoordinate(value.latitude, -90, 90, 'latitude'),
    longitude: normalizeCoordinate(value.longitude, -180, 180, 'longitude'),
    otherAssessors: normalizeOtherAssessors(value.otherAssessors),
    generalNotes: cleanText(value.generalNotes, 5000)
  };

  if (!marketInfo.marketName) {
    throw new Error('Market name is required');
  }
  if (!['Village/rural settlement', 'Small town', 'Large town/city', 'Peri-urban', 'Other', "Don't know"]
    .includes(marketInfo.setting)) {
    throw new Error('Invalid market setting');
  }
  if (marketInfo.setting === 'Other' && !marketInfo.settingOther) {
    throw new Error('Specify the other market setting');
  }

  return marketInfo;
}

function normalizeCoordinate(value, minimum, maximum, label) {
  if (value == null || String(value).trim() === '') return null;

  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) {
    throw new Error(`Invalid ${label}`);
  }
  return coordinate;
}

function normalizeOtherAssessors(value) {
  if (!Array.isArray(value)) return [];

  return value.map((assessor) => ({
    name: cleanText(assessor && assessor.name, 255),
    organization: cleanText(assessor && assessor.organization)
  })).filter((assessor) => assessor.name);
}

function buildMarketIdentityKey(marketInfo) {
  const normalized = [
    marketInfo.marketName,
    marketInfo.country,
    marketInfo.provinceState,
    marketInfo.district,
    marketInfo.cityTownVillage
  ].map((value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase());

  return JSON.stringify(normalized);
}

module.exports = {
  normalizeMarketInfo,
  buildMarketIdentityKey
};
