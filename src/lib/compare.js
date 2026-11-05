// Default players for a trade comparison: the first skater against the first skater, or goalie against goalie,
// never a goalie against a skater (they share no statistics). Unknown positions match anything.
const isGoalie = player => player.position === 'G';
const comparable = (a, b) => a.position == null || b.position == null || isGoalie(a) === isGoalie(b);

export function pickComparablePair(sides) {
  const [left, right] = sides.map(side => side.filter(player => player.id));
  for (const a of left) {
    const match = right.find(b => comparable(a, b));
    if (match) return [a, match];
  }
  return sides.map((side, index) => (index === 0 ? left : right)[0] || side[0]);
}
