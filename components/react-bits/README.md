# React Bits controls

Dock, Gooey Nav, Staggered Menu, Flying Button and Topography are the JavaScript/CSS components published by David Haz:

- https://reactbits.dev/components/dock
- https://reactbits.dev/components/gooey-nav
- https://reactbits.dev/components/staggered-menu
- https://reactbits.dev/backgrounds/topography
- https://github.com/DavidHDev/react-bits/tree/main/src/content/Micro/FlyingButton
- https://github.com/DavidHDev/react-bits/tree/main/src/content/Components

These components form part of Long D.’s portfolio under the MIT + Commons Clause license in [`REACT-BITS-LICENSE.txt`](../../src/vendor/REACT-BITS-LICENSE.txt). React’s license is retained alongside it. Gooey Nav supplies the horizontal desktop header. Staggered Menu is mounted only on phones (up to 720px) and coarse-pointer touch devices; resizing out of that layout closes the drawer and resumes the world.

The integration adds Dock item IDs and `aria-pressed`, and prevents handled toolbar navigation keys from reaching the car. Staggered Menu retains the upstream GSAP staggered layers, text/icon animations, numbering and social links. It adds translated labels, action callbacks, a close controller, inert closed links, focus trapping/return, Escape handling, reduced-motion timing and cleanup. Rapid reopen cancels a pending close animation. The existing brand supplies the logo, so the duplicate drawer logo is hidden. Purple numbering sits immediately beside each label, with a lighter dark-theme color. Mobile language controls now live outside the menu in the top-left safe area.

GSAP 3.15.0 is vendored from GreenSock’s official `dist/gsap.min.js` into `../vendor/gsap.cjs`, with only the unavailable source-map reference and trailing whitespace removed. The `.cjs` extension makes the upstream UMD export work with the local esbuild bundle. Its copyright and Standard License link remain in the source and production bundle; see [`GSAP-NOTICE.txt`](../../src/vendor/GSAP-NOTICE.txt).

`../about-topography.jsx` mounts Topography with every supplied value unchanged: blue `#4f7cff`, 22 lines, width 1.2, elevation 1, foreground 0.2, tilt 32, speed 0.25, forward direction, glow 0.6, depth of field 0.4, fog 0.35, hover lift and click pulse. The container is 600px high normally and 380px on phones or short screens. Static contours remain when WebGL2 is unavailable.

`../portfolio-controls.jsx` supplies real actions, translated labels, icon symbols and softer off-white/slate theme tokens. `npm run build:controls` bundles the controls, lazy Topography entry, CSS and one shared React runtime locally. `npm run build` refreshes those bundles before building the static site.

`../project-flying-button.jsx` lazily mounts Flying Button for the Selected Work action. The transparent flight layer spans the project stage behind its text and computer, with a stable CTA anchor and 25% button radii. The integration adds an anchor reference, a refresh controller for layout changes, half-resolution simulation, a 30fps smoke limit, DPR 1.25 and a 480,000-pixel canvas cap. Button physics remain smooth, and touch/reduced motion keep the ordinary action. Owned animation, listeners and WebGL resources are released on unmount.

Pixel Snow's original snowflake sprite artwork and atlas builder are retained in `../../src/vendor/pixel-snow-atlas.js`, under the same React Bits license. `../../src/pixel-snow.js` adapts those sprites and five weighted depth levels into the existing Three.js particle batch, rather than mounting a second WebGL canvas. It uses the requested settings with viewport-based particle budgets, coarse/reduced-motion caps, adaptive load reduction and a small shader glow. Source: https://github.com/DavidHDev/react-bits/tree/main/src/content/Backgrounds/PixelSnow .
