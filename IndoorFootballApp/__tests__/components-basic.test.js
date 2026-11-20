/* eslint-env jest */
// Tests for the basic shared components (src/components/ui, DESIGN.md section 6).

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text as NativeText,
  View,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { theme } from '../src/theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  IconButton,
  Pill,
  Screen,
  Text,
} from '../src/components/ui';
import { getInitials } from '../src/components/ui/Avatar';
import { badgeLabel } from '../src/components/ui/Badge';

async function render(element) {
  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>{element}</ThemeProvider>,
    );
  });
  return renderer;
}

// All the text a rendered tree shows, joined.
const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' ');

// The tappable element: the one with the button role whose style depends on being
// pressed (React Native's Pressable). findByType(Pressable) doesn't match it in tests.
const tappables = renderer =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityRole === 'button' &&
      typeof node.props.style === 'function',
  );
const tappable = renderer => tappables(renderer)[0];

// Its style as it is when not pressed, as one flat object.
const restingStyle = renderer =>
  StyleSheet.flatten(tappable(renderer).props.style({ pressed: false }));

const press = async renderer => {
  await ReactTestRenderer.act(() => {
    tappable(renderer).props.onPress();
  });
};

describe('Text', () => {
  test('uses the body style and text colour by default', async () => {
    const renderer = await render(<Text>Hello</Text>);
    const style = StyleSheet.flatten(
      renderer.root.findByType(NativeText).props.style,
    );
    expect(style).toMatchObject({
      ...theme.typography.body,
      color: theme.colors.text,
    });
  });

  test('takes any typography variant and colour meaning', async () => {
    const renderer = await render(
      <Text variant="display" color="accent">
        My teams
      </Text>,
    );
    const style = StyleSheet.flatten(
      renderer.root.findByType(NativeText).props.style,
    );
    expect(style.fontFamily).toBe('BarlowCondensed-Bold');
    expect(style.textTransform).toBe('uppercase');
    expect(style.color).toBe(theme.colors.accent);
  });
});

describe('Screen', () => {
  test('renders its children, scrolling or not', async () => {
    const plain = await render(
      <Screen>
        <Text>Inside</Text>
      </Screen>,
    );
    const scrolling = await render(
      <Screen scroll keyboardAware>
        <Text>Inside</Text>
      </Screen>,
    );
    expect(shownText(plain)).toBe('Inside');
    expect(shownText(scrolling)).toBe('Inside');
  });
});

describe('Button', () => {
  test('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const renderer = await render(
      <Button title="Create team" onPress={onPress} />,
    );
    await press(renderer);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('loading: shows a spinner, ignores presses, and says it is busy', async () => {
    const onPress = jest.fn();
    const renderer = await render(
      <Button title="Create team" onPress={onPress} loading />,
    );

    await press(renderer);
    await press(renderer);

    expect(onPress).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    const button = tappable(renderer);
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({
      disabled: false,
      busy: true,
    });
    expect(button.props.accessibilityLabel).toBe('Create team');
  });

  test('loading keeps the exact size: same button style, label still there but invisible', async () => {
    const idle = await render(<Button title="Create team" icon="add" />);
    const busy = await render(
      <Button title="Create team" icon="add" loading />,
    );

    expect(restingStyle(busy)).toEqual(restingStyle(idle));
    expect(shownText(busy)).toBe('Create team');
    const content = tappable(busy)
      .findAllByType(View)
      .find(
        node => StyleSheet.flatten(node.props.style)?.flexDirection === 'row',
      );
    expect(StyleSheet.flatten(content.props.style).opacity).toBe(0);
  });

  test('the spinner takes the label colour of each variant', async () => {
    const expected = {
      primary: theme.colors.onAccent,
      secondary: theme.colors.text,
      danger: theme.colors.danger,
    };
    for (const [variant, color] of Object.entries(expected)) {
      const renderer = await render(
        <Button title="Save" variant={variant} loading />,
      );
      expect([
        variant,
        renderer.root.findByType(ActivityIndicator).props.color,
      ]).toEqual([variant, color]);
    }
  });

  test('disabled: ignores presses, is dimmed and says so', async () => {
    const onPress = jest.fn();
    const renderer = await render(
      <Button title="Create team" onPress={onPress} disabled />,
    );

    await press(renderer);

    expect(onPress).not.toHaveBeenCalled();
    expect(restingStyle(renderer).opacity).toBe(theme.opacity.disabled);
    expect(tappable(renderer).props.accessibilityState).toEqual({
      disabled: true,
      busy: false,
    });
  });

  test('is at least the button height and the touch target wide', async () => {
    const renderer = await render(<Button title="OK" />);
    const style = restingStyle(renderer);
    expect(style.minHeight).toBe(theme.sizes.button);
    expect(style.minWidth).toBe(theme.touchTarget);
    expect(style.height).toBeUndefined();
  });
});

describe('IconButton', () => {
  test('warns in development without an accessibilityLabel', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await render(<IconButton variant="approve" onPress={() => {}} />);
    expect(warn).toHaveBeenCalledWith(
      'IconButton: accessibilityLabel is required (variant "approve")',
    );

    warn.mockClear();
    await render(
      <IconButton
        variant="approve"
        accessibilityLabel="Approve Nayeem Islam"
        onPress={() => {}}
      />,
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('is 44 x 44, labelled, and ignores presses when disabled', async () => {
    const onPress = jest.fn();
    const renderer = await render(
      <IconButton
        variant="reject"
        accessibilityLabel="Reject Fahim Rahman"
        onPress={onPress}
        disabled
      />,
    );
    const style = restingStyle(renderer);
    expect(style.width).toBe(theme.touchTarget);
    expect(style.height).toBe(theme.touchTarget);
    expect(tappable(renderer).props.accessibilityLabel).toBe(
      'Reject Fahim Rahman',
    );
    await press(renderer);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Avatar initials', () => {
  const intl = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  // Each case runs twice: with Intl.Segmenter (where the phone has it) and with the
  // fallback rule (where it doesn't).
  const cases = [
    ['two words', 'Nayeem Islam', 'NI'],
    ['three words use the first two', 'Rahim Uddin Ahmed', 'RU'],
    ['one word', 'rahim', 'R'],
    ['extra spaces', '   Fahim    Rahman  ', 'FR'],
    ['a non-breaking space between words', 'Sakib\u00A0Hasan', 'SH'],
    ['Bangla letters with vowel signs', 'রাকিব হাসান', 'রাহা'],
    ['Bangla, the example from the rule', 'রাহাত হাসান', 'রাহা'],
    ['an accent written as a separate mark', 'e\u0301mile Zola', 'E\u0301Z'],
    ['a flag before the name is skipped', '🇧🇩 Tanvir Ahmed', 'TA'],
    ['an emoji with a skin tone is skipped', '👍🏽 Fahim', 'F'],
    ['an emoji between the words is skipped', 'Rahim ⚽ Uddin', 'RU'],
    ['a number before the name is skipped', '10 Rahim Uddin', 'RU'],
    ['a word starting with a symbol is skipped', '#1 Fan Club', 'FC'],
    ['an emoji family alone gives "?"', '👨‍👩‍👧', '?'],
    ['an emoji alone gives "?"', '⚽', '?'],
    ['only numbers and symbols give "?"', '10 #1 🇧🇩', '?'],
  ];

  test.each(cases)('%s (Intl.Segmenter)', (_, name, expected) => {
    expect(getInitials(name, intl)).toBe(expected);
  });

  test.each(cases)('%s (fallback)', (_, name, expected) => {
    expect(getInitials(name, null)).toBe(expected);
  });

  test('the fallback keeps a Bangla joined letter whole', () => {
    // ক্ষমা: ক + virama + ষ is one joined letter (ক্ষ), then মা.
    expect(getInitials('ক্ষমা', null)).toBe('ক্ষ');
  });

  test('"?" for an empty or missing name', () => {
    for (const name of ['', '   ', undefined, null, 42]) {
      expect(getInitials(name)).toBe('?');
      expect(getInitials(name, null)).toBe('?');
    }
  });

  test('the circle uses the size tokens and shows the initials', async () => {
    const small = await render(<Avatar name="Nayeem Islam" />);
    const large = await render(
      <Avatar name="Dhanmondi Strikers" size="large" />,
    );
    const circle = renderer =>
      StyleSheet.flatten(renderer.root.findAllByType(View)[0].props.style);
    expect(circle(small).width).toBe(theme.sizes.avatarSmall);
    expect(circle(large).width).toBe(theme.sizes.avatarLarge);
    expect(shownText(small)).toBe('NI');
    expect(shownText(large)).toBe('DS');
  });
});

describe('Badge', () => {
  test('shows nothing at 0 (or for no count), the number up to 99, then 99+', async () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(-3)).toBeNull();
    expect(badgeLabel(undefined)).toBeNull();
    expect(badgeLabel(NaN)).toBeNull();
    expect(badgeLabel(1)).toBe('1');
    expect(badgeLabel(99)).toBe('99');
    expect(badgeLabel(100)).toBe('99+');
    expect(badgeLabel(1500)).toBe('99+');

    expect((await render(<Badge count={0} />)).toJSON()).toBeNull();
    expect(shownText(await render(<Badge count={3} />))).toBe('3');
    expect(shownText(await render(<Badge count={120} />))).toBe('99+');
  });
});

describe('Pill and Card', () => {
  test('a strong and a soft pill render their label in the right colours', async () => {
    const strong = await render(<Pill label="Captain" variant="strong" />);
    const soft = await render(<Pill label="2 new" />);
    const color = renderer =>
      StyleSheet.flatten(renderer.root.findByType(NativeText).props.style)
        .color;
    expect(shownText(strong)).toBe('Captain');
    expect(color(strong)).toBe(theme.colors.onAccent);
    expect(shownText(soft)).toBe('2 new');
    expect(color(soft)).toBe(theme.colors.accent);
  });

  test('a card renders its content; with onPress the whole card is tappable', async () => {
    const plain = await render(
      <Card>
        <Text>Team</Text>
      </Card>,
    );
    expect(shownText(plain)).toBe('Team');
    expect(tappables(plain)).toHaveLength(0);

    const onPress = jest.fn();
    const tappableCard = await render(
      <Card onPress={onPress} accessibilityLabel="Open Dhanmondi Strikers">
        <Text>Team</Text>
      </Card>,
    );
    await press(tappableCard);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(tappable(tappableCard).props.accessibilityRole).toBe('button');
  });
});
