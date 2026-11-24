// The bottom tab bar (docs/DESIGN.md section 6), used as React Navigation's custom
// `tabBar`:
//   <Tab.Navigator tabBar={props => <TabBar {...props} />}>
//     <Tab.Screen name="MyTeamsTab" options={{ title: 'My Teams', tabBarIconName: 'teams' }} … />
// Each tab shows an Icon (our name, from the `tabBarIconName` option) and its title.
// The standard `tabBarBadge` option shows a Badge on the icon.
//
// Pressing a tab emits React Navigation's standard tabPress event (with the same data as
// its own tab bar), so pressing the tab you're already on takes its stack back to the
// first screen. On Android the bar hides while a keyboard is on screen.
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import Badge, { badgeLabel } from './Badge';
import Icon from './Icon';
import Text from './Text';

// Lower than any on-screen keyboard, higher than the thin toolbar a physical one shows.
const MIN_KEYBOARD_HEIGHT = 100;

// True while a keyboard is on screen, on Android only (iOS keyboards cover the bar).
// With a physical keyboard (a computer's, in the emulator, or a Bluetooth one) Android
// also says "the keyboard is open" for as long as a field is focused, but nothing covers
// the screen; the bar must stay then, so the height decides.
function useAndroidKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const shown = Keyboard.addListener('keyboardDidShow', event =>
      setOpen(event.endCoordinates.height >= MIN_KEYBOARD_HEIGHT),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () =>
      setOpen(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return open;
}

// state, descriptors, navigation and insets come from React Navigation.
export default function TabBar({ state, descriptors, navigation, insets }) {
  const { colors, sizes, spacing, touchTarget } = useTheme();
  const safeArea = useSafeAreaInsets();
  const keyboardOpen = useAndroidKeyboardOpen();
  if (keyboardOpen) return null;

  const bottom = insets?.bottom ?? safeArea.bottom;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBar,
          borderTopWidth: sizes.border,
          borderTopColor: colors.border,
          paddingBottom: bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const badge = badgeLabel(options.tabBarBadge);
        const tint = focused ? colors.accent : colors.tabIdle;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
            data: {
              behavior: {
                scrollToTop: focused,
                popToTop: focused,
              },
            },
          });
          if (!focused && !event.defaultPrevented) {
            navigation.dispatch({
              ...CommonActions.navigate(route.name, route.params),
              target: state.key,
            });
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={
              options.tabBarAccessibilityLabel ??
              (badge ? `${label}, ${badge}` : label)
            }
            testID={options.tabBarButtonTestID}
            style={[
              styles.tab,
              {
                minHeight: touchTarget,
                paddingVertical: spacing.xs,
                gap: spacing.xxs,
              },
            ]}
          >
            <View>
              <Icon name={options.tabBarIconName} color={tint} />
              {badge ? (
                <Badge
                  count={options.tabBarBadge}
                  style={[
                    styles.badge,
                    { top: -spacing.xxs, left: spacing.lg },
                  ]}
                />
              ) : null}
            </View>
            <Text
              variant={focused ? 'tabLabelActive' : 'tabLabel'}
              color={focused ? 'accent' : 'tabIdle'}
              style={styles.label}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute' },
  label: { textAlign: 'center' },
});
