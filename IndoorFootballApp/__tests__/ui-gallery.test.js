/* eslint-env jest */
// The developer-only UI gallery renders every component without errors or warnings
// (an unknown icon, text variant or colour name would warn).

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import UIGalleryScreen from '../src/screens/Dev/UIGalleryScreen';

test('the UI gallery renders without warnings or errors', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});

  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <UIGalleryScreen navigation={{ goBack: jest.fn() }} />
      </ThemeProvider>,
    );
  });

  expect(renderer.toJSON()).not.toBeNull();
  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  warn.mockRestore();
  error.mockRestore();
});
