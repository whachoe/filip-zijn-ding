const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeMarketInfo, buildMarketIdentityKey } = require('../market-utils');

test('normalizes market fields and coordinates', () => {
  const marketInfo = normalizeMarketInfo({
    marketId: '4',
    marketName: '  Central Market ',
    country: ' Uganda ',
    setting: 'Village/rural settlement',
    latitude: '0.314',
    longitude: '32.581',
    otherAssessors: [
      { name: '  Second Assessor ', organization: '  Health Unit ' },
      { name: ' ' }
    ]
  });

  assert.equal(marketInfo.marketId, 4);
  assert.equal(marketInfo.marketName, 'Central Market');
  assert.equal(marketInfo.country, 'Uganda');
  assert.equal(marketInfo.latitude, 0.314);
  assert.equal(marketInfo.longitude, 32.581);
  assert.deepEqual(marketInfo.otherAssessors, [{
    name: 'Second Assessor',
    organization: 'Health Unit'
  }]);
});

test('rejects missing market names and invalid coordinates', () => {
  assert.throws(() => normalizeMarketInfo({}), /Market name is required/);
  assert.throws(() => normalizeMarketInfo({ marketName: 'Market', latitude: 91 }), /Invalid latitude/);
  assert.throws(() => normalizeMarketInfo({ marketName: 'Market', longitude: 'not-a-number' }), /Invalid longitude/);
  assert.throws(() => normalizeMarketInfo({ marketName: 'Market', marketId: 'invalid' }), /Invalid market ID/);
  assert.throws(() => normalizeMarketInfo({ marketName: 'Market', setting: '' }), /Invalid market setting/);
  assert.throws(() => normalizeMarketInfo({ marketName: 'Market', setting: 'Other' }), /Specify the other market setting/);
  assert.throws(() => normalizeMarketInfo({ marketName: 'Market', setting: 'Unknown' }), /Invalid market setting/);
});

test('accepts an explicit unknown market setting', () => {
  assert.equal(normalizeMarketInfo({ marketName: 'Market', setting: "Don't know" }).setting, "Don't know");
});

test('market identity ignores whitespace and case differences', () => {
  const first = normalizeMarketInfo({
    marketName: 'Central   Market',
    setting: "Don't know",
    country: 'UGANDA',
    provinceState: 'Central',
    district: 'Kampala',
    cityTownVillage: 'Old Town'
  });
  const second = normalizeMarketInfo({
    marketName: ' central market ',
    setting: "Don't know",
    country: 'uganda',
    provinceState: ' Central ',
    district: 'Kampala',
    cityTownVillage: 'Old   Town'
  });

  assert.equal(buildMarketIdentityKey(first), buildMarketIdentityKey(second));
});
