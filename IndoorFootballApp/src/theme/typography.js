// Font families and named text styles (docs/DESIGN.md section 4).
//
// On Android a custom font's weight comes from its file, not from fontWeight, so each
// weight is its own family (the .ttf file name in assets/fonts, which is also the
// font's PostScript name for iOS later). Text styles set fontFamily per weight and
// never set fontWeight.
//
// Line heights: about 1.1 x size for headings and 1.45 x size for everything else,
// rounded to whole pixels. Headings are uppercase with letter spacing of +2% of the
// size, built into the styles so screens never set them by hand.

export const fonts = {
  heading: 'BarlowCondensed-Bold', // 700
  regular: 'Inter-Regular', // 400
  medium: 'Inter-Medium', // 500
  semiBold: 'Inter-SemiBold', // 600
  bold: 'Inter-Bold', // 700
};

const HEADING_LINE_HEIGHT = 1.1;
const TEXT_LINE_HEIGHT = 1.45;
const HEADING_LETTER_SPACING = 0.02;

const heading = size => ({
  fontFamily: fonts.heading,
  fontSize: size,
  lineHeight: Math.round(size * HEADING_LINE_HEIGHT),
  letterSpacing: Math.round(size * HEADING_LETTER_SPACING * 100) / 100,
  textTransform: 'uppercase',
});

const text = (fontFamily, size) => ({
  fontFamily,
  fontSize: size,
  lineHeight: Math.round(size * TEXT_LINE_HEIGHT),
  letterSpacing: 0,
});

export const typography = {
  display: heading(34), // screen titles ("MY TEAMS")
  title: heading(36), // detail page titles (team name)
  cardTitle: heading(19), // team or venue names in cards
  section: heading(18), // section headings inside cards ("JOIN REQUESTS")
  body: text(fonts.regular, 15), // list item text
  bodyStrong: text(fonts.semiBold, 15), // list item names
  bodySmall: text(fonts.regular, 14), // descriptions, back links
  meta: text(fonts.regular, 13), // member counts, positions, areas
  pill: text(fonts.bold, 12), // pills
  tabLabel: text(fonts.medium, 11), // tab labels
  tabLabelActive: text(fonts.semiBold, 11), // the active tab's label
  button: text(fonts.bold, 14), // primary button labels
  buttonSecondary: text(fonts.semiBold, 14), // secondary button labels
  badge: text(fonts.bold, 11), // badge counts
};
