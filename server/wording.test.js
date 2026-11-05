import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('visitor-facing text never calls Puck Haul or its data official', () => {
  for (const file of ['src/main.jsx', 'src/SeasonHome.jsx', 'src/FavouriteTeams.jsx', 'src/PlayerPicker.jsx', 'index.html', 'README.md']) {
    assert.doesNotMatch(read(file), /official NHL|Official NHL|official trade/, `${file} implies an official NHL product`);
  }
});

test('the footer and the no-JavaScript page both say Puck Haul is independent', () => {
  assert.match(read('src/main.jsx'), /independent fan project\. It is not affiliated with or endorsed by the NHL/);
  assert.match(read('index.html'), /not affiliated with or endorsed by the NHL/);
});

test('upstream requests identify the site without a personal contact', () => {
  const agent = read('server/index.js').match(/'User-Agent': '([^']+)'/)[1];
  assert.match(agent, /^PuckHaul-NHL-Dashboard\/[\d.]+ \(\+https:\/\/puckhaul\.app\)$/);
  assert.doesNotMatch(agent, /@/);
});
