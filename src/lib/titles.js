// Browser-tab and screen-reader titles for each view. Home keeps the page's own title (see index.html).
const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const tradeDate = date => { const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(date || ''); return match && months[Number(match[1]) - 1] ? `${months[Number(match[1]) - 1]} ${Number(match[2])}` : ''; };

export function viewTitle({ view, tradeTab, trade, seasonLabel }) {
  if (view === 'Trades' && tradeTab === 'compare') {
    const date = tradeDate(trade?.date);
    return trade?.to?.abbrev && trade?.from?.abbrev && date ? `${trade.to.abbrev}–${trade.from.abbrev} Trade, ${date} | Puck Haul` : 'Compare NHL Players | Puck Haul';
  }
  if (view === 'Trades') return 'NHL Trade Wire and Player Comparisons | Puck Haul';
  if (view === 'Standings') return seasonLabel ? `NHL Standings, ${seasonLabel} | Puck Haul` : 'NHL Standings | Puck Haul';
  return null;
}
