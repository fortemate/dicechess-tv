import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import icon from '../../native/icon/icon-512.png';

// Starlight takes the favicon only as a file in public/, and the icon is not
// copied there: it has one home, native/icon/. So each page's favicon link is
// pointed at the icon Astro already emits for the logo, and a browser fetches
// the one file for both.
export const onRequest = defineRouteMiddleware(({ locals }) => {
  const favicon = locals.starlightRoute.head.find(
    ({ tag, attrs }) => tag === 'link' && attrs?.rel === 'shortcut icon',
  );
  // Fail the build rather than ship Starlight's default favicon: its file does
  // not exist here, so every page would link to a 404.
  if (!favicon) {
    throw new Error('Starlight emitted no favicon link to point at the icon.');
  }
  favicon.attrs = { rel: 'icon', href: icon.src, type: 'image/png' };
});
