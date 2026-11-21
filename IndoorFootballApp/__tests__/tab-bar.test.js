/* eslint-env jest */
// Tests for the bottom tab bar (src/components/ui/TabBar.js, DESIGN.md section 6),
// given the same props React Navigation gives a custom tabBar.

import React from 'react';
import { StyleSheet, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { theme } from '../src/theme';
import { TabBar } from '../src/components/ui';

const TABS = [
  { name: 'MyTeamsTab', title: 'My Teams', icon: 'teams' },
  { name: 'ExploreTab', title: 'Explore', icon: 'explore' },
  { name: 'NotificationsTab', title: 'Notifications', icon: 'notifications' },
  { name: 'ProfileTab', title: 'Profile', icon: 'profile' },
];

function props({ index = 0, badge, defaultPrevented = false } = {}) {
  return {
    state: {
      key: 'tabs-key',
      index,
      routes: TABS.map(tab => ({ key: `${tab.name}-key`, name: tab.name })),
    },
    descriptors: Object.fromEntries(
      TABS.map(tab => [
        `${tab.name}-key`,
        {
          options: {
            title: tab.title,
            tabBarIconName: tab.icon,
            tabBarBadge: tab.name === 'NotificationsTab' ? badge : undefined,
          },
        },
      ]),
    ),
    navigation: {
      emit: jest.fn(() => ({ defaultPrevented })),
      dispatch: jest.fn(),
    },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  };
}

async function render(tabBarProps) {
  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <TabBar {...tabBarProps} />
      </ThemeProvider>,
    );
  });
  return renderer;
}

// The tab buttons, in order.
const tabs = renderer =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityRole === 'tab' &&
      typeof node.props.onPress === 'function' &&
      typeof node.props.onLongPress === 'function',
  );

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''));

describe('TabBar', () => {
  test('renders every tab label, at least the touch target tall', async () => {
    const renderer = await render(props());
    expect(shownText(renderer)).toEqual([
      'My Teams',
      'Explore',
      'Notifications',
      'Profile',
    ]);
    expect(tabs(renderer)).toHaveLength(4);
    for (const tab of tabs(renderer)) {
      expect(StyleSheet.flatten(tab.props.style).minHeight).toBe(
        theme.touchTarget,
      );
    }
  });

  test('marks the active tab as selected, in accent with the active label style', async () => {
    const renderer = await render(props({ index: 1 }));
    expect(tabs(renderer).map(t => t.props.accessibilityState)).toEqual([
      { selected: false },
      { selected: true },
      { selected: false },
      { selected: false },
    ]);
    const label = title =>
      StyleSheet.flatten(
        renderer.root
          .findAllByType(NativeText)
          .find(node => node.props.children === title).props.style,
      );
    expect(label('Explore')).toMatchObject({
      ...theme.typography.tabLabelActive,
      color: theme.colors.accent,
    });
    expect(label('Profile')).toMatchObject({
      ...theme.typography.tabLabel,
      color: theme.colors.tabIdle,
    });
  });

  test('shows a badge count on its tab, and says it', async () => {
    const renderer = await render(props({ badge: 3 }));
    expect(shownText(renderer)).toContain('3');
    expect(tabs(renderer)[2].props.accessibilityLabel).toBe('Notifications, 3');

    const many = await render(props({ badge: 150 }));
    expect(shownText(many)).toContain('99+');

    const none = await render(props({ badge: 0 }));
    expect(shownText(none)).toEqual([
      'My Teams',
      'Explore',
      'Notifications',
      'Profile',
    ]);
  });

  test('pressing another tab emits tabPress, then navigates to it', async () => {
    const tabBarProps = props({ index: 0 });
    const renderer = await render(tabBarProps);

    await ReactTestRenderer.act(() => tabs(renderer)[2].props.onPress());

    const { emit, dispatch } = tabBarProps.navigation;
    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'NotificationsTab-key',
      canPreventDefault: true,
      data: { behavior: { scrollToTop: false, popToTop: false } },
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'NAVIGATE',
        payload: expect.objectContaining({ name: 'NotificationsTab' }),
        target: 'tabs-key',
      }),
    );
  });

  test("pressing the tab you're on asks its stack to go back to the first screen, without navigating", async () => {
    const tabBarProps = props({ index: 0 });
    const renderer = await render(tabBarProps);

    await ReactTestRenderer.act(() => tabs(renderer)[0].props.onPress());

    expect(tabBarProps.navigation.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tabPress',
        data: { behavior: { scrollToTop: true, popToTop: true } },
      }),
    );
    expect(tabBarProps.navigation.dispatch).not.toHaveBeenCalled();
  });

  test('a listener that prevents the tabPress stops the navigation', async () => {
    const tabBarProps = props({ index: 0, defaultPrevented: true });
    const renderer = await render(tabBarProps);

    await ReactTestRenderer.act(() => tabs(renderer)[3].props.onPress());

    expect(tabBarProps.navigation.dispatch).not.toHaveBeenCalled();
  });
});
