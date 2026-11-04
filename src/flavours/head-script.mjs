import { completeChoice, normalizePath, redirectTarget } from './resolve.mjs';

/** The `localStorage` key that holds the saved choice, as JSON of axis to flavour. */
export const storageKey = 'vs-apps-docs.flavours';

/**
 * Inline script for `<head>`. It sends a full page load of a flavourless address to the saved choice
 * before the body paints. The React redirect in `FlavourRoute` covers navigation inside the app.
 */
export function headScript({ axes, defaults, redirects, baseUrl }) {
  const config = JSON.stringify({ axes, defaults, redirects, baseUrl });
  return `(function(){try{
${[normalizePath, completeChoice, redirectTarget].map(String).join('\n')}
var saved=null;
try{saved=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}))}catch(e){}
var to=redirectTarget(Object.assign(${config},{pathname:location.pathname,saved:saved}));
if(to)location.replace(to+location.search+location.hash);
}catch(e){}})();`;
}
