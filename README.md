# BallBetter

A basketball equipment storefront, built as static HTML, CSS and JavaScript.
No build step and no dependencies — open `index.html`, or serve the folder.

```
python3 -m http.server 8000
```

## Pages

| File | What it is |
|---|---|
| `index.html` | Landing page: hero, featured rail, category grid, stats, FAQ |
| `shop.html` | Full catalog with category filters (`?c=balls`) |
| `product.html` | Product detail, rendered from `?id=` against the catalog |
| `about.html` | Brand and testing standards |
| `support.html` | Shipping, returns, warranty, sizing, contact form |

## Structure

- `assets/js/catalog.js` — the product catalog. Every surface reads from it,
  so adding a product here adds it to the shop, its detail page, and the
  related-products rails at once.
- `assets/js/app.js` — the interaction layer.
- `assets/css/style.css` — tokens, type scale, components, a11y overrides.

Product artwork is drawn as inline SVG rather than loaded as images, so it
stays crisp at any size and follows the colour theme.

## The 3D hero

The basketball on the landing page is real geometry in WebGL, written against
the raw API with no library and no CDN — it works offline and adds nothing to
load. `assets/js/hero3d.js` generates the sphere and the four seams as tube
meshes at runtime, and the pebble grain is procedural noise in the fragment
shader that perturbs the surface normal, so it holds up at any zoom.

The seams are the real topology: one great circle around the equator, one
through the poles, and two curved seams that bend one way going down the front
and the other coming back up.

It is grabbable, and that is where the gesture rules do the work:

- Dragging tracks the pointer 1:1.
- Releasing hands the spin the pointer's measured velocity, taken from a
  ~90 ms history rather than the last frame, so a flick reads its real speed.
- Momentum decays toward a slow idle drift instead of to a dead stop.
- Grabbing it mid-spin takes over from the current angle and kills the
  momentum, so there is no fight between your hand and the animation.
- Arrow keys spin it too, and the stage is focusable and labelled.

Without WebGL the page falls back to a static SVG ball. Under reduced motion
the idle spin stops but the ball stays draggable.

## How the motion works

Animation is spring-driven rather than CSS-transition-driven, so it can be
interrupted. Every spring starts from the current on-screen value and carries
its velocity through a re-target, which means the cart sheet, the product rail
and the FAQ can each be grabbed and reversed mid-flight without a jump.

- **Springs** are critically damped by default (`response 0.4`, `damping 1.0`).
  A little bounce (`damping 0.8`) is added only after a flick, where momentum
  justifies it.
- **Flicks** project where the gesture was going — `(v/1000)·d/(1−d)` with
  `d = 0.998` — and snap to the nearest card from there, rather than stopping
  where the finger lifted.
- **Boundaries** rubber-band: resistance grows with overshoot instead of
  hitting a wall.
- **Press feedback** fires on `pointerdown`, not on click, and cancels if the
  pointer drags away with ~10px of hysteresis.
- **Chrome** is a translucent material with a `backdrop-filter`; content
  scrolls beneath it and the hairline appears only once something is under it.

## Accessibility

Three user preferences are honoured independently:

- `prefers-reduced-motion` — springs snap, slides become cross-fades. Feedback
  is still present, just non-vestibular.
- `prefers-reduced-transparency` — materials go solid, blur is dropped.
- `prefers-contrast: more` — near-solid surfaces with defined borders.

Light and dark themes both ship. The cart traps focus, closes on Escape, and
restores focus to whatever opened it.

## Notes

Checkout and the contact form are inert — this is a storefront demo and
nothing is transmitted. The cart persists in `localStorage`.
