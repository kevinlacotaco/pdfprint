import { expect, test, describe } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Button } from './Button';

describe('Button tests', () => {
  test('default button has type button', async () => {
    render(<Button onClick={undefined}>Test</Button>);

    const button = await screen.findByRole('button');

    expect(button.getAttribute('type')).toBe('button');
  });
});
