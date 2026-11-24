/* eslint-env jest */
// Tests for the composite shared components (src/components/ui, DESIGN.md section 6),
// plus a guard that keeps every component file free of raw colours and font names.

import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { theme } from '../src/theme';
import {
  BackLink,
  ConfirmDialog,
  Divider,
  EmptyState,
  Icon,
  ListRow,
  NoticeLine,
  ScreenHeader,
  SectionHeader,
  TextField,
  TextLink,
} from '../src/components/ui';

async function render(element) {
  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>{element}</ThemeProvider>,
    );
  });
  return renderer;
}

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' ');

// Tappable elements (React Native's Pressable): a role and a style that depends on
// being pressed. findByType(Pressable) doesn't match them in tests.
const tappables = renderer =>
  renderer.root.findAll(
    node =>
      ['button', 'link'].includes(node.props.accessibilityRole) &&
      typeof node.props.style === 'function',
  );
const tappableLabelled = (renderer, label) =>
  tappables(renderer).find(node => node.props.accessibilityLabel === label);

const act = fn => ReactTestRenderer.act(fn);

describe('ListRow', () => {
  test('a line between rows, none after the last row', async () => {
    const rows = ['Nayeem Islam', 'Fahim Rahman', 'Sakib Hasan'];
    const renderer = await render(
      <>
        {rows.map((name, i) => (
          <ListRow
            key={name}
            name={name}
            meta="Defender"
            last={i === rows.length - 1}
          />
        ))}
      </>,
    );
    expect(renderer.root.findAllByType(Divider)).toHaveLength(2);
  });

  test('shows the name, meta and trailing item; tappable rows are labelled', async () => {
    const onPress = jest.fn();
    const renderer = await render(
      <ListRow
        name="Rahim Uddin"
        meta="Midfielder"
        trailing={<NativeText>Captain</NativeText>}
        onPress={onPress}
        last
      />,
    );
    expect(shownText(renderer)).toContain('Rahim Uddin');
    expect(shownText(renderer)).toContain('Midfielder');
    expect(shownText(renderer)).toContain('Captain');
    const row = tappableLabelled(renderer, 'Rahim Uddin, Midfielder');
    await act(() => row.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('actions sit beside the tappable part of the row, not inside it; trailing stays inside', async () => {
    const onPress = jest.fn();
    const renderer = await render(
      <ListRow
        name="Nayeem Islam"
        meta="Midfielder"
        onPress={onPress}
        trailing={<NativeText>Captain</NativeText>}
        actions={<TextLink title="Remove" onPress={() => {}} />}
        last
      />,
    );
    const row = tappableLabelled(renderer, 'Nayeem Islam, Midfielder');
    const remove = tappableLabelled(renderer, 'Remove');
    expect(remove).toBeTruthy();
    expect(row.findAll(node => node === remove)).toHaveLength(0);
    expect(
      row.findAll(
        node => node.type === NativeText && node.props.children === 'Captain',
      ),
    ).toHaveLength(1);
  });

  test('actions on a row that is not tappable still show', async () => {
    const renderer = await render(
      <ListRow
        name="Nayeem Islam"
        actions={<TextLink title="Invite" onPress={() => {}} />}
      />,
    );
    expect(tappableLabelled(renderer, 'Invite')).toBeTruthy();
    expect(renderer.root.findAllByType(Divider)).toHaveLength(1);
  });
});

describe('ConfirmDialog', () => {
  const dialog = props => (
    <ConfirmDialog
      visible
      title="Delete this team?"
      message="Everyone in it loses the team."
      confirmTitle="Delete team"
      destructive
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      {...props}
    />
  );
  // The Modal: the element that handles Android's back button.
  const modal = renderer =>
    renderer.root.findAll(
      node => typeof node.props.onRequestClose === 'function',
    )[0];
  // The dimmed area outside the dialog.
  const backdrop = renderer =>
    renderer.root.findAll(
      node =>
        node.props.accessible === false &&
        typeof node.props.onPress === 'function',
    )[0];

  test('Confirm calls onConfirm; Cancel, back and tapping outside call onCancel', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const renderer = await render(dialog({ onConfirm, onCancel }));

    expect(shownText(renderer)).toContain('Delete this team?');
    await act(() => tappableLabelled(renderer, 'Delete team').props.onPress());
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(() => tappableLabelled(renderer, 'Cancel').props.onPress());
    await act(() => modal(renderer).props.onRequestClose());
    await act(() => backdrop(renderer).props.onPress());
    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  test('while loading, back, tapping outside and Cancel are ignored, and Confirm is busy', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const renderer = await render(
      dialog({ onConfirm, onCancel, loading: true }),
    );

    await act(() => modal(renderer).props.onRequestClose());
    await act(() => backdrop(renderer).props.onPress());
    await act(() => tappableLabelled(renderer, 'Cancel').props.onPress());
    await act(() => tappableLabelled(renderer, 'Delete team').props.onPress());

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      tappableLabelled(renderer, 'Delete team').props.accessibilityState,
    ).toEqual({ disabled: false, busy: true });
  });

  test('uses the floating shadow, and danger for a destructive confirm', async () => {
    const renderer = await render(dialog({}));
    const box = renderer.root.findAll(
      node => node.props.accessibilityViewIsModal === true,
    )[0];
    expect(StyleSheet.flatten(box.props.style)).toMatchObject(
      theme.shadows.floating,
    );
    const confirmLabel = renderer.root
      .findAllByType(NativeText)
      .find(node => node.props.children === 'Delete team');
    expect(StyleSheet.flatten(confirmLabel.props.style).color).toBe(
      theme.colors.danger,
    );
  });
});

describe('TextField', () => {
  test('shows the error message with its warning icon, and reads it with the field', async () => {
    const renderer = await render(
      <TextField label="Email" value="" error="Email is required" />,
    );
    expect(shownText(renderer)).toContain('Email is required');
    const icons = renderer.root.findAllByType(Icon);
    expect(icons.map(i => i.props.name)).toContain('warning');
    const input = renderer.root.findByType(TextInput);
    expect(input.props.accessibilityLabel).toBe('Email');
    expect(input.props.accessibilityHint).toBe('Email is required');
  });

  test('shows the helper when there is no error', async () => {
    const renderer = await render(
      <TextField
        label="Area"
        helper="For example Dhanmondi, not a full address"
      />,
    );
    expect(shownText(renderer)).toContain('For example Dhanmondi');
    expect(renderer.root.findAllByType(Icon)).toHaveLength(0);
  });

  test('the password show/hide button toggles and is labelled', async () => {
    const renderer = await render(<TextField label="Password" secure />);
    const input = () => renderer.root.findByType(TextInput);

    expect(input().props.secureTextEntry).toBe(true);
    await act(() =>
      tappableLabelled(renderer, 'Show password').props.onPress(),
    );
    expect(input().props.secureTextEntry).toBe(false);
    expect(tappableLabelled(renderer, 'Hide password')).toBeDefined();
    await act(() =>
      tappableLabelled(renderer, 'Hide password').props.onPress(),
    );
    expect(input().props.secureTextEntry).toBe(true);
  });

  test('disabled: not editable and says so', async () => {
    const renderer = await render(<TextField label="Email" disabled />);
    const input = renderer.root.findByType(TextInput);
    expect(input.props.editable).toBe(false);
    expect(input.props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('Headers, links and notices', () => {
  test('ScreenHeader shows a greeting or a back link, the title and an action', async () => {
    const onBack = jest.fn();
    const withGreeting = await render(
      <ScreenHeader greeting="Salam, Rahim" title="My teams" />,
    );
    expect(shownText(withGreeting)).toContain('Salam, Rahim');
    expect(shownText(withGreeting)).toContain('My teams');

    const withBack = await render(
      <ScreenHeader
        back={{ label: 'My Teams', onPress: onBack }}
        title="Dhanmondi Strikers"
        action={<NativeText>Action</NativeText>}
      />,
    );
    await act(() =>
      tappableLabelled(withBack, 'Back to My Teams').props.onPress(),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(shownText(withBack)).toContain('Action');
  });

  test('BackLink and TextLink are at least the touch target tall', async () => {
    const back = await render(<BackLink label="My Teams" onPress={() => {}} />);
    const link = await render(
      <TextLink title="See all 11" onPress={() => {}} />,
    );
    for (const renderer of [back, link]) {
      const style = StyleSheet.flatten(
        tappables(renderer)[0].props.style({ pressed: false }),
      );
      expect(style.minHeight).toBe(theme.touchTarget);
    }
  });

  test('SectionHeader, NoticeLine and EmptyState render their text', async () => {
    const section = await render(
      <SectionHeader
        title="Join requests"
        right={<NativeText>2 new</NativeText>}
      />,
    );
    expect(shownText(section)).toContain('Join requests');
    expect(shownText(section)).toContain('2 new');

    const notice = await render(
      <NoticeLine strong="2 join requests" text="waiting for you" />,
    );
    expect(shownText(notice)).toContain('2 join requests');
    expect(shownText(notice)).toContain('waiting for you');

    const onAction = jest.fn();
    const empty = await render(
      <EmptyState
        message="You're not in a team yet."
        actionTitle="Create team"
        onAction={onAction}
      />,
    );
    expect(shownText(empty)).toContain("You're not in a team yet.");
    await act(() => tappableLabelled(empty, 'Create team').props.onPress());
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('Token guard: src/components/ui uses theme tokens only', () => {
  const folder = path.join(__dirname, '../src/components/ui');
  const files = fs.readdirSync(folder).filter(name => name.endsWith('.js'));

  // A raw colour (#abc, #aabbcc, #aabbccdd), a font family set by hand, or a font file
  // name. Comments count too: keep examples out of them.
  const rules = [
    [
      'a raw hex colour',
      /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/,
    ],
    ['a raw rgb/hsl colour', /\b(?:rgba?|hsla?)\(/],
    ['a font family set by hand', /fontFamily\s*:\s*['"]/],
    ['a font name', /\b(?:Inter|Barlow)/],
  ];

  test('there are component files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  test.each(files)('%s', name => {
    const source = fs.readFileSync(path.join(folder, name), 'utf8');
    const problems = rules
      .filter(([, pattern]) => pattern.test(source))
      .map(([what]) => what);
    expect({ file: name, problems }).toEqual({ file: name, problems: [] });
  });
});

describe('ListRow with an icon and a hint (feature 2)', () => {
  test('the icon replaces the avatar, and the hint is a third line', async () => {
    const renderer = await render(
      <ListRow
        icon="phone"
        name="Phone"
        meta="01712345678"
        hint="Only your teammates can see this"
        last
      />,
    );
    expect(renderer.root.findAllByType(Icon).map(i => i.props.name)).toEqual([
      'phone',
    ]);
    expect(shownText(renderer)).toBe(
      'Phone 01712345678 Only your teammates can see this',
    );
  });

  test('without an icon it still shows the initials', async () => {
    const renderer = await render(<ListRow name="Nayeem Islam" last />);
    expect(renderer.root.findAllByType(Icon)).toHaveLength(0);
    expect(shownText(renderer)).toContain('NI');
  });
});
