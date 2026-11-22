/* eslint-env jest */
// Tests for the shared Icon component (src/components/ui/Icon.js, DESIGN.md section 7).

import React from 'react';
import { View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import Users from 'lucide-react-native/icons/users';
import Icon, { ICON_NAMES } from '../src/components/ui/Icon';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { theme } from '../src/theme';

async function render(element) {
  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>{element}</ThemeProvider>,
    );
  });
  return renderer;
}

describe('Icon', () => {
  test('renders a known name with the theme defaults', async () => {
    const renderer = await render(<Icon name="teams" />);

    const glyph = renderer.root.findByType(Users);
    expect(glyph.props.size).toBe(24);
    expect(glyph.props.strokeWidth).toBe(theme.icon.strokeWidth);
    expect(theme.icon.strokeWidth).toBe(1.8);
    expect(renderer.toJSON()).not.toBeNull();
  });

  test('the default colour is the theme text colour; size and colour can be set', async () => {
    const plain = await render(<Icon name="teams" />);
    expect(plain.root.findByType(Users).props.color).toBe(theme.colors.text);

    const custom = await render(
      <Icon name="teams" size={18} color={theme.colors.accent} />,
    );
    const glyph = custom.root.findByType(Users);
    expect(glyph.props.size).toBe(18);
    expect(glyph.props.color).toBe(theme.colors.accent);
  });

  test('renders nothing for an unknown name, and warns once in development', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const first = await render(<Icon name="not-an-icon" />);
    await render(<Icon name="not-an-icon" />);

    expect(first.toJSON()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Icon: unknown name "not-an-icon"');
    warn.mockRestore();
  });

  test('with a label it is announced as an image', async () => {
    const renderer = await render(
      <Icon name="approve" accessibilityLabel="Approve Nayeem Islam" />,
    );

    const wrapper = renderer.root.findByType(View);
    expect(wrapper.props.accessible).toBe(true);
    expect(wrapper.props.accessibilityRole).toBe('image');
    expect(wrapper.props.accessibilityLabel).toBe('Approve Nayeem Islam');
    expect(wrapper.props.importantForAccessibility).toBe('yes');
  });

  test('without a label it is decorative and hidden from screen readers', async () => {
    const renderer = await render(<Icon name="approve" />);

    const wrapper = renderer.root.findByType(View);
    expect(wrapper.props.accessible).toBe(false);
    expect(wrapper.props.accessibilityLabel).toBeUndefined();
    expect(wrapper.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(wrapper.props.accessibilityElementsHidden).toBe(true);
  });

  test('every name in the map renders', async () => {
    // 42 names; venues and venue share one Lucide icon (41 icons in all).
    expect(ICON_NAMES).toHaveLength(42);
    for (const name of ICON_NAMES) {
      const renderer = await render(<Icon name={name} />);
      expect({ name, rendered: renderer.toJSON() !== null }).toEqual({
        name,
        rendered: true,
      });
    }
  });
});
