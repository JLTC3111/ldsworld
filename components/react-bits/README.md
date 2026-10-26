# React Bits controls

Dock, Staggered Menu and Topography are the JavaScript/CSS components published by David Haz:

- https://reactbits.dev/components/dock
- https://reactbits.dev/components/staggered-menu
- https://reactbits.dev/backgrounds/topography
- https://github.com/DavidHDev/react-bits/tree/main/src/content/Components

These components form part of Long D.’s portfolio under the MIT + Commons Clause license in [`REACT-BITS-LICENSE.txt`](../../src/vendor/REACT-BITS-LICENSE.txt). React’s license is retained alongside it. The previous Gooey Nav source is retained but is no longer mounted.

The integration adds Dock item IDs and `aria-pressed`, and prevents handled toolbar navigation keys from reaching the car. Staggered Menu retains the upstream GSAP staggered layers, text/icon animations, numbering and social links. It adds translated labels, action callbacks, a close controller, inert closed links, focus trapping/return, Escape handling, reduced-motion timing and cleanup. Rapid reopen cancels a pending close animation. The existing brand supplies the logo, so the duplicate drawer logo is hidden.

GSAP 3.15.0 is vendored from GreenSock’s official `dist/gsap.min.js` into `../vendor/gsap.cjs`, with only the unavailable source-map reference and trailing whitespace removed. The `.cjs` extension makes the upstream UMD export work with the local esbuild bundle. Its copyright and Standard License link remain in the source and production bundle; see [`GSAP-NOTICE.txt`](../../src/vendor/GSAP-NOTICE.txt).

`../about-topography.jsx` mounts Topography with every supplied value unchanged: blue `#4f7cff`, 22 lines, width 1.2, elevation 1, foreground 0.2, tilt 32, speed 0.25, forward direction, glow 0.6, depth of field 0.4, fog 0.35, hover lift and click pulse. The container is 600px high normally and 380px on phones or short screens. Static contours remain when WebGL2 is unavailable.

`../portfolio-controls.jsx` supplies real actions, translated labels, icon symbols and softer off-white/slate theme tokens. `npm run build:controls` bundles the controls, lazy Topography entry, CSS and one shared React runtime locally. `npm run build` refreshes those bundles before building the static site.
