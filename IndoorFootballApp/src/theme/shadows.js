// Shadows (docs/DESIGN.md section 5): only for floating things such as dialogs and
// pop-ups, never cards. Android draws shadows from `elevation`; iOS uses the shadow*
// properties.
import { colors } from './colors';

export const shadows = {
  floating: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};
