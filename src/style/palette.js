// The one colour source for the whole diorama and UI. Sampled from the ithappy reference:
// pink tile floors, powder-blue wainscot, mustard stripe, dusty-mauve upper wall, teal sofas, yellow doors.
export const C = {
  // scene
  backdrop: '#b7c3d3', backdropDeep: '#9fadc2', backdropLight: '#cdd6e2',
  // wall language
  wainscot: '#b5d8ee', wainscotDeep: '#9cc8e4', stripe: '#f0c04a', stripeDeep: '#dda935',
  upper: '#d6c6c9', upperDeep: '#c4b1b6', trim: '#ffffff', trimWarm: '#f7f3ee',
  door: '#f0bf3e', doorDeep: '#d9a62c', doorFrame: '#fbfaf7',
  // floors
  tilePink: '#f5cbc1', tilePinkLight: '#fadfd8', groutPink: '#e6b3a8', tileRose: '#e98f98',
  tileCream: '#f3ece1', groutCream: '#e2d8c9', tileMint: '#cdeedd', groutMint: '#aedcc7',
  tileLilac: '#ded6f2', groutLilac: '#c7bce6', tileSky: '#d3e8f6', groutSky: '#b6d5ea',
  tileButter: '#fbecbc', groutButter: '#eedb9c', tileSage: '#d6e7cf', groutSage: '#bbd5b1',
  tileAqua: '#c9efef', groutAqua: '#a6dede', tileGrey: '#e7e6e8', groutGrey: '#d3d2d7',
  // soft furnishings
  teal: '#2fc4c4', tealDeep: '#1fa3a6', tealLight: '#7fe0dc',
  blanket: '#bfe4f6', blanketDeep: '#94cfee', sheet: '#f6f8fb', pillow: '#ffffff',
  purple: '#a58be0', purpleLight: '#cdbff0', coral: '#ff8a7a', coralDeep: '#e4606a', rose: '#f39aa8',
  curtain: '#7f5d52', curtainDeep: '#66483f', curtainBlue: '#9fd0ea', curtainMint: '#a9e2c8',
  // hard furnishings
  white: '#ffffff', offWhite: '#f2f3f6', plastic: '#e6e9ef', steel: '#b9bec8', steelDeep: '#8f96a3',
  charcoal: '#3a3f4a', ink: '#2c2f38', screen: '#20303a', screenGlow: '#7cf0c8',
  cartBlue: '#3b7fd0', cartBlueDeep: '#2a62aa', wood: '#c79a6b', woodDeep: '#a97c50', woodLight: '#e1bf95',
  // plants + exterior
  leaf: '#2f9460', leafDeep: '#1f7248', leafLight: '#55bd7e', pot: '#e9dfd2', trunk: '#8a6647',
  grass: '#a8dc9c', grassDeep: '#8fcb86', hedge: '#5fb878', asphalt: '#7d8798', asphaltLight: '#98a2b2',
  curb: '#e8ebf0', paving: '#ece5da', pavingDeep: '#dcd2c4', lineWhite: '#f8f9fb', lineYellow: '#f5cc55',
  soil: '#b98f70', soilDeep: '#9a7259', rock: '#8d93a3', rockDeep: '#6f7688',
  // state colours (shared by 3D labels and UI)
  ok: '#2fbf8f', info: '#4aa8e8', watch: '#f5b43a', danger: '#ef5a63', free: '#2fbf8f', busy: '#4aa8e8',
  // people
  scrubNurse: '#5cc3d6', scrubDoctor: '#ffffff', scrubSurgeon: '#79c7a4', scrubTech: '#a58be0', scrubPorter: '#f6a85c',
  gown: '#cfe6f5', paramedic: '#ef6a5a', skin: ['#f8d7bf', '#eebd98', '#d39a70', '#a86f4c', '#7c4f36'],
  hair: ['#2d2a2e', '#5b3b2c', '#8a5a36', '#c78f4b', '#e6c27a', '#a9a9b5', '#b4483f'],
};

// Per-department room themes. shell.js uses these for floor tile + wall tint.
export const THEMES = {
  lobby:     { tile: [C.tileCream, C.groutCream], wainscot: '#a9e0dc', stripe: C.stripe, upper: '#e5d9cf', accent: C.teal },
  er:        { tile: [C.tileMint, C.groutMint],   wainscot: '#ffc4b4', stripe: C.coralDeep, upper: '#e9dcd8', accent: C.coralDeep },
  imaging:   { tile: [C.tileLilac, C.groutLilac], wainscot: '#c9bdf0', stripe: C.stripe, upper: '#ded7ea', accent: C.purple },
  lab:       { tile: [C.tileSky, C.groutSky],     wainscot: '#a9d3ef', stripe: C.stripe, upper: '#d9e3ec', accent: C.info },
  pharmacy:  { tile: [C.tileButter, C.groutButter], wainscot: '#b7e6c3', stripe: C.stripe, upper: '#ebe3cf', accent: C.leafLight },
  core:      { tile: [C.tileGrey, C.groutGrey],   wainscot: '#c8d0dc', stripe: C.stripe, upper: '#dcdce2', accent: C.steelDeep },
  corridor:  { tile: [C.tileGrey, C.groutGrey],   wainscot: C.wainscot, stripe: C.stripe, upper: C.upper, accent: C.teal },
  ward:      { tile: [C.tilePink, C.groutPink],   wainscot: C.wainscot, stripe: C.stripe, upper: C.upper, accent: C.rose },
  icu:       { tile: [C.tileAqua, C.groutAqua],   wainscot: '#a4e3dc', stripe: C.stripe, upper: '#d7e4e4', accent: C.tealDeep },
  nurses:    { tile: [C.tileCream, C.groutCream], wainscot: C.wainscot, stripe: C.stripe, upper: C.upper, accent: C.teal },
  or:        { tile: [C.tileSage, C.groutSage],   wainscot: '#b5e0bd', stripe: C.stripe, upper: '#dbe7da', accent: C.leaf },
};
