/* BallBetter catalog. Single source of truth for every product surface. */

const CATALOG = [
  {
    id: 'court-pro-7',
    name: 'Court Pro 7',
    tagline: 'The indoor game ball.',
    category: 'balls',
    price: 89,
    badge: 'New',
    hue: 22,
    summary:
      'Full-grain composite leather with a moisture-channelling pebble. Broken in from the first possession, and it stays that way through a full season of practice.',
    highlights: [
      ['Size', 'Official 29.5" · 22 oz'],
      ['Surface', 'Indoor hardwood'],
      ['Cover', 'Full-grain composite'],
      ['Channels', 'Deep 3.2 mm'],
    ],
    story: [
      {
        title: 'Grip you stop thinking about.',
        body:
          'A 4,096-point pebble pattern is pressed, not printed, so the texture goes all the way through the cover. The ball holds its bite past the point where a printed surface has already gone slick.',
      },
      {
        title: 'True off every bounce.',
        body:
          'A butyl bladder wound with nylon thread keeps pressure inside 0.2 PSI across a season. What comes back off the floor is what you put into it.',
      },
    ],
  },
  {
    id: 'blacktop-all-weather',
    name: 'Blacktop All-Weather',
    tagline: 'Built for concrete.',
    category: 'balls',
    price: 54,
    hue: 14,
    summary:
      'A rubber cover engineered to survive the outdoor court. Deeper pebble, tougher carcass, and a bounce that holds up long after a leather ball would have surrendered.',
    highlights: [
      ['Size', "Official 29.5\" · Also 28.5\""],
      ['Surface', 'Asphalt · concrete'],
      ['Cover', 'Abrasion-rated rubber'],
      ['Warranty', '2 years'],
    ],
    story: [
      {
        title: 'Abrasion is the enemy.',
        body:
          'The compound is tuned for wear rather than showroom feel. After 500 simulated court hours it keeps 91% of its original pebble height.',
      },
      {
        title: 'One ball, every court.',
        body:
          'Wet blacktop, cold mornings, August afternoons. The cover barely notices the difference, so neither do you.',
      },
    ],
  },
  {
    id: 'flight-01',
    name: 'Flight 01',
    tagline: 'Low to the floor.',
    category: 'footwear',
    price: 165,
    badge: 'New',
    hue: 210,
    summary:
      'A guard shoe with a 6 mm heel-to-toe drop and a containment cage that lets you change direction without waiting for the shoe to catch up.',
    highlights: [
      ['Drop', '6 mm'],
      ['Weight', '11.4 oz (US 10)'],
      ['Cushion', 'Dual-density foam'],
      ['Outsole', 'Herringbone rubber'],
    ],
    story: [
      {
        title: 'Cut, then go.',
        body:
          'The midsole sits inside a TPU cradle instead of on top of it. Your foot stays over the platform through a hard cut rather than rolling toward its edge.',
      },
      {
        title: 'Traction that clears itself.',
        body:
          'A tight herringbone with wide evacuation channels sheds dust between possessions, so squeak one is the same as squeak forty.',
      },
    ],
  },
  {
    id: 'anchor-post',
    name: 'Anchor Post',
    tagline: 'A hoop that does not flinch.',
    category: 'hoops',
    price: 749,
    hue: 200,
    summary:
      'In-ground system with a tempered glass backboard and a breakaway rim rated for full-weight dunks. Height adjusts from 7\'6" to 10\' with one hand.',
    highlights: [
      ['Backboard', '54" tempered glass'],
      ['Rim', 'Breakaway · 180 lb rated'],
      ['Post', '5" square steel'],
      ['Height', "7'6\" – 10'"],
    ],
    story: [
      {
        title: 'Glass, because glass is honest.',
        body:
          'Tempered glass returns the ball the way a gym does. Acrylic softens the bank shot and teaches you the wrong angle.',
      },
      {
        title: 'Adjusts in seconds.',
        body:
          'A counterbalanced lift moves the whole assembly with one hand, so the hoop meets whoever is playing instead of the other way around.',
      },
    ],
  },
  {
    id: 'rep-counter',
    name: 'Rep Counter',
    tagline: 'Shooting, measured.',
    category: 'training',
    price: 129,
    hue: 268,
    summary:
      'A rim-mounted sensor that logs every attempt, make, and arc angle, then hands the session back to you as a chart you can actually read.',
    highlights: [
      ['Battery', '40 hours'],
      ['Tracking', 'Make · miss · arc · depth'],
      ['Mount', 'Tool-free, any rim'],
      ['Sync', 'Bluetooth 5.3'],
    ],
    story: [
      {
        title: 'The number that matters.',
        body:
          'Not how many you took. Where the misses clustered, and what your arc was doing on the shots that went in.',
      },
      {
        title: 'Nothing to set up.',
        body:
          'Clamp it, shoot. The session is on your phone before you have finished collecting the rebounds.',
      },
    ],
  },
  {
    id: 'weighted-trainer',
    name: 'Weighted Trainer',
    tagline: 'Heavier on purpose.',
    category: 'training',
    price: 72,
    hue: 32,
    summary:
      'A 3 lb training ball that exposes lazy mechanics immediately. Fifteen minutes with it makes the game ball feel weightless.',
    highlights: [
      ['Weight', '3 lb'],
      ['Size', 'Official 29.5"'],
      ['Cover', 'Textured rubber'],
      ['Use', 'Handles · passing · form'],
    ],
    story: [
      {
        title: 'Strength where the game needs it.',
        body:
          'Wrists, forearms, fingertips. The muscles that decide whether a handle survives contact.',
      },
      {
        title: 'Honest feedback.',
        body:
          'A loose dribble that a light ball forgives, this one does not. The correction happens on its own.',
      },
    ],
  },
  {
    id: 'practice-kit',
    name: 'Practice Kit',
    tagline: 'Reversible. Breathable.',
    category: 'apparel',
    price: 68,
    hue: 348,
    summary:
      'A jersey and short cut for movement, in a knit that pulls sweat off the skin and gives it somewhere to go. Reversible, so a scrimmage never needs pinnies.',
    highlights: [
      ['Fabric', 'Recycled poly mesh'],
      ['Fit', 'Athletic, reversible'],
      ['Sizes', 'XS – 3XL'],
      ['Care', 'Machine wash cold'],
    ],
    story: [
      {
        title: 'Two teams, one kit.',
        body:
          'Turn it inside out and the scrimmage sorts itself. Both faces are finished, so neither one is the wrong side.',
      },
      {
        title: 'Dry where it counts.',
        body:
          'Open mesh across the back and under the arms; a tighter knit everywhere contact happens.',
      },
    ],
  },
  {
    id: 'gym-carry',
    name: 'Gym Carry',
    tagline: 'Everything, in one trip.',
    category: 'apparel',
    price: 94,
    hue: 190,
    summary:
      'A 32 L duffel with a dedicated ball compartment, a vented shoe tunnel, and a wet pocket that keeps the rest of the bag out of it.',
    highlights: [
      ['Volume', '32 L'],
      ['Ball', 'Fits one official size'],
      ['Shoes', 'Vented side tunnel'],
      ['Shell', '600D recycled poly'],
    ],
    story: [
      {
        title: 'A place for the ball.',
        body:
          'The ball rides in its own compartment instead of deforming everything around it.',
      },
      {
        title: 'Wet stays wet, alone.',
        body:
          'A sealed pocket takes the soaked shirt so the clean clothes stay clean.',
      },
    ],
  },
];

const CATEGORIES = [
  { id: 'all', label: 'Everything' },
  { id: 'balls', label: 'Balls' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'hoops', label: 'Hoops' },
  { id: 'training', label: 'Training' },
  { id: 'apparel', label: 'Apparel & Bags' },
];

const money = (n) => '$' + n.toLocaleString('en-US');
const findProduct = (id) => CATALOG.find((p) => p.id === id);
