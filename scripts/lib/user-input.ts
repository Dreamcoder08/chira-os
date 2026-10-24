/** Pure parsing and validation for the account commands, kept separate to test it. */
export type Role = 'technician' | 'coordinator';

export type UserInput = {
  email: string;
  name: string;
  role: Role;
  association: string;
};

const roles: Role[] = ['technician', 'coordinator'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PasswordResetInput = { email: string };

export function describeUsage(): string {
  return [
    'Usage: pnpm user:create --email <email> --name "<full name>" \\',
    '         --role <technician|coordinator> --association "<name or id>"',
  ].join('\n');
}

export function describePasswordUsage(): string {
  return 'Usage: pnpm user:password --email <email>';
}

/**
 * Reads `--key=value` and `--key value` pairs. One implementation so both
 * commands accept exactly the same flag syntax.
 */
function parseFlags(argv: string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith('--'))
      throw new Error(`Unexpected argument: ${argument}`);
    const separator = argument.indexOf('=');
    const key =
      separator === -1 ? argument.slice(2) : argument.slice(2, separator);
    const value =
      separator === -1 ? argv[(index += 1)] : argument.slice(separator + 1);
    if (value === undefined || value === '')
      throw new Error(`Missing value for --${key}`);
    values.set(key, value);
  }
  return values;
}

export function parsePasswordArgs(argv: string[]): PasswordResetInput {
  const values = parseFlags(argv);
  return { email: values.get('email') ?? '' };
}

export function validatePasswordResetInput(
  input: PasswordResetInput,
): string[] {
  const errors: string[] = [];
  if (!emailPattern.test(input.email))
    errors.push(`--email must be an email address, got "${input.email}"`);
  return errors;
}

export function parseUserArgs(argv: string[]): UserInput {
  const values = parseFlags(argv);
  return {
    email: values.get('email') ?? '',
    name: values.get('name') ?? '',
    role: (values.get('role') ?? 'technician') as Role,
    association: values.get('association') ?? '',
  };
}

export function validateUserInput(input: UserInput): string[] {
  const errors: string[] = [];
  if (!emailPattern.test(input.email))
    errors.push(`--email must be an email address, got "${input.email}"`);
  if (input.name.trim().length < 2)
    errors.push('--name must have at least two characters');
  if (!roles.includes(input.role))
    errors.push(
      `--role must be one of ${roles.join(', ')}, got "${input.role}"`,
    );
  if (input.association.trim() === '')
    errors.push('--association must name an existing association or its id');
  return errors;
}
