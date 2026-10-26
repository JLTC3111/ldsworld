# React Bits controls

Dock, Gooey Nav and Topography are the JavaScript/CSS components published by David Haz:

- https://reactbits.dev/components/dock
- https://reactbits.dev/components/gooey-nav
- https://reactbits.dev/backgrounds/topography
- https://github.com/DavidHDev/react-bits/tree/main/src/content/Components

These components are included as part of Long D.'s portfolio, under the MIT + Commons Clause license in [`REACT-BITS-LICENSE.txt`](../../src/vendor/REACT-BITS-LICENSE.txt). React's license is retained alongside it.

The portfolio integration adds Dock item IDs and `aria-pressed`, and prevents handled toolbar navigation keys from reaching the driving controls. Gooey Nav receives a translated navigation label and fires navigation actions when an already-selected item is clicked, so Home can return from a World or Help panel. Animation engines and component styling otherwise follow upstream source.

`../about-topography.jsx` mounts Topography with the owner’s configured parameters and a static contour fallback when WebGL is unavailable.

`../portfolio-controls.jsx` supplies the real actions, translated labels, icon symbols and monochrome theme tokens. `npm run build:controls` bundles React and all three components into the locally served control and Topography entries and CSS, with one shared React runtime chunk. `npm run build` refreshes these bundles before building the static site. There are no runtime CDN or package-registry requests.
