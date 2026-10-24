import { describe, expect, it } from 'vitest';
import {
  parsePasswordArgs,
  parseUserArgs,
  validatePasswordResetInput,
  validateUserInput,
} from '../../scripts/lib/user-input.ts';

describe('pilot account input', () => {
  it('parses space-separated and inline values', () => {
    const input = parseUserArgs([
      '--email=tecnico@chira.test',
      '--name',
      'Técnica de campo',
      '--role',
      'coordinator',
      '--association',
      'Asociación Chira',
    ]);
    expect(input).toEqual({
      email: 'tecnico@chira.test',
      name: 'Técnica de campo',
      role: 'coordinator',
      association: 'Asociación Chira',
    });
    expect(validateUserInput(input)).toEqual([]);
  });

  it('defaults the role to technician', () => {
    const input = parseUserArgs([
      '--email',
      'campo@chira.test',
      '--name',
      'Campo',
      '--association',
      'Asociación Chira',
    ]);
    expect(input.role).toBe('technician');
  });

  it('rejects an argument without its value', () => {
    expect(() => parseUserArgs(['--email'])).toThrow(
      'Missing value for --email',
    );
    expect(() => parseUserArgs(['tecnico@chira.test'])).toThrow(
      'Unexpected argument',
    );
  });

  it('reports every invalid field instead of the first one', () => {
    const errors = validateUserInput({
      email: 'not-an-email',
      name: ' ',
      role: 'administrator' as never,
      association: '',
    });
    expect(errors).toHaveLength(4);
    expect(errors[0]).toContain('--email');
    expect(errors[1]).toContain('--name');
    expect(errors[2]).toContain('--role');
    expect(errors[3]).toContain('--association');
  });
});

describe('pilot password reset input', () => {
  it('accepts the same flag syntax as account creation', () => {
    expect(parsePasswordArgs(['--email=tecnico@chira.test'])).toEqual({
      email: 'tecnico@chira.test',
    });
    expect(parsePasswordArgs(['--email', 'campo@chira.test'])).toEqual({
      email: 'campo@chira.test',
    });
  });

  it('rejects a missing or malformed email', () => {
    expect(validatePasswordResetInput(parsePasswordArgs([]))).toHaveLength(1);
    expect(
      validatePasswordResetInput(parsePasswordArgs(['--email=tecnico'])),
    ).toEqual(['--email must be an email address, got "tecnico"']);
    expect(() => parsePasswordArgs(['--email'])).toThrow(
      'Missing value for --email',
    );
  });
});
