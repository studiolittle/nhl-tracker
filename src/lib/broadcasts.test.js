import test from 'node:test';
import assert from 'node:assert/strict';
import { getBroadcasts } from './broadcasts.js';
const game = (tvBroadcasts, home='OTT', away='TOR') => ({season:20262027,home:{abbrev:home},away:{abbrev:away},tvBroadcasts});
const b = (network,market='N',countryCode='CA') => ({network,market,countryCode});
test('Ottawa sees Senators regional coverage, not a visiting team blackout',()=>{
 const result=getBroadcasts(game([b('TSN5','H'),b('RDSI','H'),b('TSN4','A')]));
 assert.deepEqual(result.channels.map(c=>c.name),['TSN5','RDS Info']); assert.equal(result.regional,true);
});
test('Prime exclusive requires national Canadian rights, never a US regional stream',()=>{
 assert.equal(getBroadcasts(game([b('Prime')])).exclusivePrime,true);
 assert.equal(getBroadcasts(game([b('Prime','H','US')])).exclusivePrime,false);
 assert.equal(getBroadcasts(game([b('Prime'),b('TVAS')])).exclusivePrime,false);
 assert.equal(getBroadcasts({...game([b('Prime')]),season:20402041}).exclusivePrime,false);
});
test('missing Canadian listings do not imply streaming exclusivity or US availability',()=>{
 const result=getBroadcasts(game([b('ESPN','N','US')],'BOS','NYR'));
 assert.equal(result.unavailable,true); assert.equal(result.onlyStreaming,false); assert.equal(result.outOfMarket,true);
});
test('out-of-market Leafs regional broadcast is not recommended in Ottawa',()=>{
 assert.equal(getBroadcasts(game([b('TSN4','A')],'VGK','TOR')).channels.length,0);
 assert.equal(getBroadcasts(game([b('TSN4','A')],'VGK','TOR'),'canada').channels.length,1);
});
test('Sportsnet+ does not override a local TSN blackout; national TV remains visible',()=>{
 assert.deepEqual(getBroadcasts(game([b('SN+'),b('TSN5','H')])).channels.map(c=>c.name),['TSN5']);
 assert.deepEqual(getBroadcasts(game([b('SN'),b('TVAS')])).channels.map(c=>c.name),['Sportsnet','TVA Sports']);
});
test('a missing Ottawa regional feed is not replaced with a possibly blacked-out stream',()=>{
 const result=getBroadcasts(game([b('SN+'),b('TSN4','A')]));
 assert.equal(result.unavailable,true);
});
