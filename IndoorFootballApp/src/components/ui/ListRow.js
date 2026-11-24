// A row inside a card (docs/DESIGN.md section 6): avatar (or an icon), name, meta, an
// optional hint, an optional trailing item (a pill, the "Captain" label, a chevron) and
// optional actions (buttons). A line separates rows: pass `last` on the final row so
// there's no line after it.
//   {rows.map((r, i) => <ListRow key={r.id} name={r.name} meta={r.position}
//                                last={i === rows.length - 1} />)}
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Avatar from './Avatar';
import Divider from './Divider';
import Icon from './Icon';
import Text from './Text';

// name: shown in bodyStrong and used for the avatar's initials.
// meta: optional muted line ("Winger · Mohammadpur").
// icon: one of our Icon names, shown instead of the avatar (rows that aren't people:
//   "Phone", "Change password").
// hint: optional third line, smaller and muted ("Only your teammates can see this").
// trailing: optional element on the right that belongs to the row (a pill, a label, a
//   chevron); on a tappable row it is part of what you tap.
// actions: optional buttons on the far right (icon buttons, a Cancel or Invite button).
//   They always sit beside the row's tap area, never inside it, so on a tappable row a
//   button press never opens the row, the row's pressed look doesn't dim them, and
//   screen readers reach each button on its own.
// onPress: makes the row tappable.
// accessibilityLabel: for a tappable row, if "name, meta" isn't clear enough.
export default function ListRow({
  name,
  meta,
  icon,
  hint,
  trailing,
  actions,
  onPress,
  last = false,
  accessibilityLabel,
  style,
}) {
  const { colors, spacing, opacity, touchTarget } = useTheme();

  const content = (
    <>
      {icon ? (
        <Icon name={icon} color={colors.textMuted} />
      ) : (
        <Avatar name={name} />
      )}
      <View style={styles.middle}>
        <Text variant="bodyStrong">{name}</Text>
        {meta ? (
          <Text variant="meta" color="textMuted">
            {meta}
          </Text>
        ) : null}
        {hint ? (
          <Text variant="meta" color="textMuted">
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ?? null}
    </>
  );

  const rowLook = {
    minHeight: touchTarget,
    paddingVertical: spacing.md,
    gap: spacing.md,
  };

  const body = onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (meta ? `${name}, ${meta}` : name)
      }
      style={({ pressed }) => [
        styles.row,
        rowLook,
        actions ? styles.fill : null,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.row, rowLook, actions ? styles.fill : null]}>
      {content}
    </View>
  );

  return (
    <View style={style}>
      {actions ? (
        <View style={[styles.row, { gap: spacing.md }]}>
          {body}
          {actions}
        </View>
      ) : (
        body
      )}
      {last ? null : <Divider />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  middle: { flex: 1 },
  fill: { flex: 1 },
});
