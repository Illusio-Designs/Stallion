/**
 * Hand-off between "show a notification" and the toast library.
 *
 * The toast library (with its animation code) is loaded after the page is up instead of with the
 * first scripts. A notification asked for before it is ready (for example "session expired" on the
 * very first request) waits here and is shown the moment the toaster is mounted, in the same order.
 */

let sink = null; // (type, title, options) => void, set once the toaster is on screen
let loader = null; // () => void, starts loading the toaster now
const waiting = [];

export const showToast = (type, title, options) => {
  if (sink) {
    sink(type, title, options);
    return;
  }
  waiting.push([type, title, options]);
  // Somebody needs a toast right now: do not wait for the quiet moment, load the toaster at once.
  if (loader) loader();
};

/** The provider tells the queue how to start loading the toaster. */
export const setToasterLoader = (fn) => { loader = fn; };

/** The toaster calls this when it is mounted. Returns a function that detaches it. */
export const attachToastSink = (fn) => {
  sink = fn;
  waiting.splice(0).forEach(([type, title, options]) => fn(type, title, options));
  return () => { if (sink === fn) sink = null; };
};
