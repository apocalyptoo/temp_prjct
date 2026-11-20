// A row inside a card (docs/DESIGN.md section 6): avatar, name, meta and an optional
// trailing item (a pill, icon buttons, the "Captain" label). A line separates rows:
// pass `last` on the final row so there's no line after it.
//   {rows.map((r, i) => <ListRow key={r.id} name={r.name} meta={r.position}
//                                last={i === rows.length - 1} />)}
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Avatar from './Avatar';
import Divider from './Divider';
import Text from './Text';

// name: shown in bodyStrong and used for the avatar's initials.
// meta: optional muted line ("Winger · Mohammadpur").
// trailing: optional element on the right. onPress: makes the row tappable.
// accessibilityLabel: for a tappable row, if "name, meta" isn't clear enough.
export default function ListRow({
  name,
  meta,
  trailing,
  onPress,
  last = false,
  accessibilityLabel,
  style,
}) {
  const { spacing, opacity, touchTarget } = useTheme();

  const content = (
    <>
      <Avatar name={name} />
      <View style={styles.middle}>
        <Text variant="bodyStrong">{name}</Text>
        {meta ? (
          <Text variant="meta" color="textMuted">
            {meta}
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

  return (
    <View style={style}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityLabel ?? (meta ? `${name}, ${meta}` : name)
          }
          style={({ pressed }) => [
            styles.row,
            rowLook,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={[styles.row, rowLook]}>{content}</View>
      )}
      {last ? null : <Divider />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  middle: { flex: 1 },
});
