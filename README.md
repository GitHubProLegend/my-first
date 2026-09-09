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
