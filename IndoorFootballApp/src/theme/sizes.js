// Sizes and opacity (docs/DESIGN.md section 5). Sizes are minimums wherever something
// holds text, so it can grow with the phone's font-size setting.

export const sizes = {
  field: 48, // text field minimum height
  button: 46, // button minimum height
  avatarSmall: 38, // avatars in list rows
  avatarLarge: 44, // avatars in team cards
  badge: 18, // badge minimum width and height
  dot: 8, // the small "waiting for you" dot
  border: 1, // card borders, dividers, outlined buttons, fields
  dialogMaxWidth: 400, // confirmation dialogs on wide screens
  logo: 72, // the ball logo on the Login screen
};

export const opacity = {
  disabled: 0.45, // disabled controls
  pressed: 0.8, // while a tappable card or button is held down
};
