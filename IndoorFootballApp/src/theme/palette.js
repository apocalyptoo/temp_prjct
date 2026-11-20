// Raw colours with plain names: the only place hex values live (docs/DESIGN.md
// section 3). Screens never import this file. They use the meanings in colors.js,
// through useTheme(). Changing the look means pointing colors.js at other palette
// colours, or swapping these values.
export const palette = {
  // nearBlack is also the Android window background before the first screen draws:
  // keep `app_background` in android/app/src/main/res/values/colors.xml the same.
  nearBlack: '#0E1116',
  slate950: '#12161C',
  slate900: '#171B22',
  slate800: '#262C36',
  gray500: '#7D8794',
  gray400: '#9AA3AF',
  snow: '#F3F5F7',
  lime: '#C6F432',
  // lime at 13% opacity (0x22 = 34 of 255)
  limeSoft: '#C6F43222',
  coral: '#FF7A7A',
  red: '#FF5C5C',
  black: '#000000',
};
