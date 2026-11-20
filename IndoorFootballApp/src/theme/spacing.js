// Spacing (docs/DESIGN.md section 5). Screens should prefer the layout tokens
// (screenPadding, cardPadding, listGap, detailGap, cardGap) and use the size scale
// only for one-off gaps.

const scale = {
  xxs: 4,
  xs: 8,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

export const spacing = {
  ...scale,
  screenPadding: scale.xl, // 20: screen side padding
  cardPadding: scale.lg, // 16: padding inside cards
  listGap: scale.xl, // 20: gap between cards on list screens
  detailGap: 18, // gap between cards on detail screens (not on the scale, by design)
  cardGap: scale.md, // 12: gap between items inside a card
};

// Anything tappable is at least this wide and tall.
export const touchTarget = 44;
