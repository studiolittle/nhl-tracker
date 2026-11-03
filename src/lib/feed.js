// State rules for a polled feed. Data already on screen stays there while a refresh runs or fails;
// the loader is only for a first load, and an error only replaces the panel when there is nothing to show.
export const feedStart = url => ({ url, data: null, loading: Boolean(url), error: '' });
export const feedRefresh = (previous, url) => {
  const keep = previous.url === url && previous.data;
  return { url, data: keep ? previous.data : null, loading: !keep, error: keep ? previous.error : '' };
};
export const feedLoaded = (url, data) => ({ url, data, loading: false, error: '' });
export const feedFailed = (previous, url, error) => ({ url, data: previous.url === url ? previous.data : null, loading: false, error });
