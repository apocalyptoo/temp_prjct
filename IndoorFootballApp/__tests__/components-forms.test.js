/* eslint-env jest */
// Tests for the form components added with feature 2 (src/components/ui, DESIGN.md
// section 6): Checkbox and OptionGroup. Their files are also covered by the token guard
// in components-composite.test.js.

import React from 'react';
import { StyleSheet, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { theme } from '../src/theme';
import { Checkbox, Icon, OptionGroup, TextLink } from '../src/components/ui';

async function render(element) {
  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>{element}</ThemeProvider>,
    );
  });
  return renderer;
}

const act = fn => ReactTestRenderer.act(fn);

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' ');

// Pressables found by role, with their style worked out for "not pressed".
const byRole = (renderer, role) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityRole === role &&
      typeof node.props.style === 'function',
  );
const styleOf = node =>
  StyleSheet.flatten(node.props.style({ pressed: false }));

describe('Checkbox', () => {
  test('is a 44-tall checkbox labelled by its sentence, and says whether it is ticked', async () => {
    const renderer = await render(
      <Checkbox checked={false} onChange={() => {}} label="I agree" />,
    );
    const [box] = byRole(renderer, 'checkbox');
    expect(box.props.accessibilityLabel).toBe('I agree');
    expect(box.props.accessibilityState).toEqual({
      checked: false,
      disabled: false,
    });
    expect(styleOf(box).minHeight).toBeGreaterThanOrEqual(theme.touchTarget);
    expect(renderer.root.findAllByType(Icon)).toHaveLength(0);
  });

  test('tapping calls onChange with the opposite value; ticked shows the check', async () => {
    const onChange = jest.fn();
    const renderer = await render(
      <Checkbox checked onChange={onChange} label="I agree" />,
    );
    const [box] = byRole(renderer, 'checkbox');
    expect(box.props.accessibilityState.checked).toBe(true);
    expect(renderer.root.findAllByType(Icon).map(i => i.props.name)).toEqual([
      'approve',
    ]);
    await act(() => box.props.onPress());
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('links under the label stay separately tappable and do not toggle the box', async () => {
    const onChange = jest.fn();
    const openTerms = jest.fn();
    const renderer = await render(
      <Checkbox checked={false} onChange={onChange} label="I agree">
        <TextLink title="Terms of Use" onPress={openTerms} />
      </Checkbox>,
    );
    const [link] = byRole(renderer, 'link');
    await act(() => link.props.onPress());
    expect(openTerms).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('shows its error with the warning icon and reads it with the box', async () => {
    const renderer = await render(
      <Checkbox
        checked={false}
        onChange={() => {}}
        label="I agree"
        error="Please accept the Terms of Use and Privacy Policy"
      />,
    );
    expect(shownText(renderer)).toContain(
      'Please accept the Terms of Use and Privacy Policy',
    );
    expect(renderer.root.findAllByType(Icon).map(i => i.props.name)).toContain(
      'warning',
    );
    expect(byRole(renderer, 'checkbox')[0].props.accessibilityHint).toBe(
      'Please accept the Terms of Use and Privacy Policy',
    );
  });

  test('disabled: says so and ignores taps', async () => {
    const onChange = jest.fn();
    const renderer = await render(
      <Checkbox checked={false} onChange={onChange} label="I agree" disabled />,
    );
    const [box] = byRole(renderer, 'checkbox');
    expect(box.props.accessibilityState.disabled).toBe(true);
    await act(() => box.props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('OptionGroup', () => {
  const POSITIONS = ['Goalkeeper', 'Defender', 'Forward'];

  test('a labelled radiogroup with one 44-tall radio per option', async () => {
    const renderer = await render(
      <OptionGroup label="Position" options={POSITIONS} value={null} />,
    );
    const group = renderer.root.find(
      node => node.props.accessibilityRole === 'radiogroup',
    );
    expect(group.props.accessibilityLabel).toBe('Position');
    const radios = byRole(renderer, 'radio');
    expect(radios.map(r => r.props.accessibilityLabel)).toEqual(POSITIONS);
    for (const radio of radios) {
      expect(styleOf(radio).minHeight).toBeGreaterThanOrEqual(
        theme.touchTarget,
      );
      expect(radio.props.accessibilityState.selected).toBe(false);
    }
  });

  test('the chosen option is selected and drawn in the accent colour', async () => {
    const renderer = await render(
      <OptionGroup label="Position" options={POSITIONS} value="Defender" />,
    );
    const radios = byRole(renderer, 'radio');
    const chosen = radios.find(r => r.props.accessibilityLabel === 'Defender');
    const other = radios.find(r => r.props.accessibilityLabel === 'Forward');
    expect(chosen.props.accessibilityState.selected).toBe(true);
    expect(styleOf(chosen).backgroundColor).toBe(theme.colors.accent);
    expect(styleOf(other).backgroundColor).toBe(theme.colors.surface);
  });

  test('tapping an option calls onChange with its value; { value, label } options work too', async () => {
    const onChange = jest.fn();
    const renderer = await render(
      <OptionGroup
        label="Pick"
        options={[{ value: 'gk', label: 'Goalkeeper' }]}
        value={null}
        onChange={onChange}
      />,
    );
    await act(() => byRole(renderer, 'radio')[0].props.onPress());
    expect(onChange).toHaveBeenCalledWith('gk');
  });

  test('shows its error with the warning icon', async () => {
    const renderer = await render(
      <OptionGroup
        label="Position"
        options={POSITIONS}
        value={null}
        error="Choose a position"
      />,
    );
    expect(shownText(renderer)).toContain('Choose a position');
    expect(renderer.root.findAllByType(Icon).map(i => i.props.name)).toContain(
      'warning',
    );
  });

  test('disabled: says so and ignores taps', async () => {
    const onChange = jest.fn();
    const renderer = await render(
      <OptionGroup
        label="Position"
        options={POSITIONS}
        value={null}
        onChange={onChange}
        disabled
      />,
    );
    const radio = byRole(renderer, 'radio')[0];
    expect(radio.props.accessibilityState.disabled).toBe(true);
    await act(() => radio.props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  });
});
