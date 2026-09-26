// Chart colours are deeper steps of the brand hues: the pastel brand fills are
// too light to read as data marks on white. Validated with the dataviz
// palette checker (lightness band, chroma, colour-blind separation, and 3:1
// contrast against the surface) in this slot order.
export const SERIES_COLORS = {
  pink: '#cc3aab',
  amber: '#b88100',
  blue: '#2a8bd0',
  violet: '#5a3d99',
} as const
