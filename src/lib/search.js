// Search text ignores case and accents, so "raty" finds Räty and "montreal" finds Montréal.
export const searchText = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const matchesSearch = (text, query) => searchText(text).includes(searchText(query).trim());
