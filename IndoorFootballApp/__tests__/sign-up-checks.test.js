/* eslint-env jest */
// Tests for the checks the sign-up forms run before sending (feature 2,
// docs/features/profiles-and-registration.md, section e): the phone tidy-up, the
// password rule copied from the backend, and every field's message.

import { cleanPhone, isMobileNumber } from '../src/utils/phone';
import {
  byteCount,
  isStrongPassword,
  newPasswordProblem,
  PASSWORD_HELPER,
  PASSWORD_RULE_MESSAGE,
  PASSWORD_TOO_LONG,
} from '../src/utils/password';
import {
  checkOwnerSignUp,
  checkPlayerSignUp,
  emailProblem,
  firstErrorOffset,
  phoneProblem,
} from '../src/screens/Auth/signUpCommon';
import { POSITIONS } from '../src/constants/positions';

const PHONE_RULE =
  'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678';

describe('cleanPhone and isMobileNumber', () => {
  test.each([
    ['01712345678', '01712345678'],
    ['01712 345678', '01712345678'], // spaces
    [' 017 1234 5678 ', '01712345678'],
    ['01712-345-678', '01712345678'], // dashes
    ['01712 - 345678', '01712345678'],
    ['+8801712345678', '01712345678'], // +88
    ['+880 1712-345678', '01712345678'],
    ['8801712345678', '01712345678'], // 88
    ['88 01712 345678', '01712345678'],
  ])('"%s" becomes "%s", a valid number', (typed, tidied) => {
    expect(cleanPhone(typed)).toBe(tidied);
    expect(isMobileNumber(cleanPhone(typed))).toBe(true);
  });

  test.each([
    ['01212345678'], // third digit 2
    ['0171234567'], // 10 digits
    ['+8812345678901'], // 88 not followed by 01: left alone
    ['+881712345678'], // the 0 is missing after +88
    ['017123456789'], // 12 digits
    ['(017) 12345678'], // brackets aren't removed
    ['০১৭১২৩৪৫৬৭৮'], // Bangla digits aren't converted
    [''],
  ])('"%s" is still invalid after tidying', typed => {
    expect(isMobileNumber(cleanPhone(typed))).toBe(false);
  });

  test('a number that is not a Bangladeshi mobile number is never turned into one', () => {
    expect(cleanPhone('+8812345678901')).toBe('+8812345678901');
    expect(cleanPhone('881712345678')).toBe('881712345678');
  });
});

describe('The password rule (the same as the backend)', () => {
  test('needs 8 characters with upper case, lower case, a number and one of the listed symbols', () => {
    expect(isStrongPassword('Valid-pass-123!')).toBe(true);
    expect(isStrongPassword('Aa1!aaaa')).toBe(true);
    expect(isStrongPassword('Aa1!aaa')).toBe(false); // 7 characters
    expect(isStrongPassword('aa1!aaaa')).toBe(false); // no upper case
    expect(isStrongPassword('AA1!AAAA')).toBe(false); // no lower case
    expect(isStrongPassword('Aaa!aaaa')).toBe(false); // no number
    // A dash or an underscore isn't one of the backend's symbols.
    expect(isStrongPassword('My-pass-123')).toBe(false);
    expect(isStrongPassword('My_pass_123')).toBe(false);
  });

  test('the helper lists every symbol the backend counts', () => {
    for (const symbol of '!@#$%^&*(),.?":{}|<>') {
      expect(PASSWORD_HELPER).toContain(symbol);
    }
  });

  test('bytes are counted in UTF-8, like bcrypt', () => {
    expect(byteCount('abc')).toBe(3);
    expect(byteCount('অ')).toBe(3);
    expect(byteCount('😀')).toBe(4);
  });

  test('newPasswordProblem gives the backend messages, in order', () => {
    expect(newPasswordProblem('')).toBe('Password is required');
    expect(newPasswordProblem('weak')).toBe(PASSWORD_RULE_MESSAGE);
    expect(newPasswordProblem('Aa1!' + 'a'.repeat(68))).toBeNull(); // 72 bytes
    expect(newPasswordProblem('Aa1!' + 'a'.repeat(69))).toBe(PASSWORD_TOO_LONG);
  });
});

describe('Email and phone checks', () => {
  test('email: required, a plausible address (plus signs allowed), at most 254 characters', () => {
    expect(emailProblem('  ')).toBe('Email is required');
    expect(emailProblem('not-an-email')).toBe(
      'Please enter a valid email address',
    );
    expect(emailProblem('a b@gmail.com')).toBe(
      'Please enter a valid email address',
    );
    expect(emailProblem('me+player@gmail.com')).toBeNull();
    expect(emailProblem(' Me@Gmail.com ')).toBeNull();
    expect(emailProblem(`${'a'.repeat(250)}@b.co`)).toBe(
      'Email must be at most 254 characters',
    );
  });

  test('phone: required, then the rule after tidying', () => {
    expect(phoneProblem(' ')).toBe('Phone number is required');
    expect(phoneProblem('+880 1712-345678')).toBeNull();
    expect(phoneProblem('01212345678')).toBe(PHONE_RULE);
  });
});

describe('The whole sign-up forms', () => {
  const goodPlayer = {
    name: 'Rahim Uddin',
    email: 'me+player@gmail.com',
    phone: '+8801712345678',
    position: 'Forward',
    password: 'Valid-pass-123!',
    confirm: 'Valid-pass-123!',
    agreed: true,
  };

  test('a good player form has no problems', () => {
    expect(checkPlayerSignUp(goodPlayer)).toEqual({
      ok: true,
      errors: {
        name: null,
        email: null,
        phone: null,
        position: null,
        password: null,
        confirm: null,
        terms: null,
      },
    });
  });

  test('an empty player form has a message for every field', () => {
    const { ok, errors } = checkPlayerSignUp({
      name: '',
      email: '',
      phone: '',
      position: null,
      password: '',
      confirm: '',
      agreed: false,
    });
    expect(ok).toBe(false);
    expect(errors).toEqual({
      name: 'Name is required',
      email: 'Email is required',
      phone: 'Phone number is required',
      position: 'Choose a position',
      password: 'Password is required',
      confirm: 'Confirm your password',
      terms: 'Please accept the Terms of Use and Privacy Policy',
    });
  });

  test('names are counted in code points after trimming (Bangla letters count as one)', () => {
    const check = name =>
      checkPlayerSignUp({ ...goodPlayer, name }).errors.name;
    expect(check(' A ')).toBe('Name must be between 2 and 50 characters');
    expect(check('অ'.repeat(50))).toBeNull();
    expect(check('অ'.repeat(51))).toBe(
      'Name must be between 2 and 50 characters',
    );
  });

  test('only the five positions count; mismatched passwords are caught', () => {
    for (const position of POSITIONS) {
      expect(checkPlayerSignUp({ ...goodPlayer, position }).ok).toBe(true);
    }
    expect(
      checkPlayerSignUp({ ...goodPlayer, position: 'Pivot' }).errors.position,
    ).toBe('Choose a position');
    expect(
      checkPlayerSignUp({ ...goodPlayer, confirm: 'Valid-pass-124!' }).errors
        .confirm,
    ).toBe("Passwords don't match");
  });

  test('the owner form: venue name 2–60 characters, then email, password and Terms', () => {
    const goodOwner = {
      venueName: 'Floodlight Arena',
      email: 'me+owner@gmail.com',
      password: 'Valid-pass-123!',
      confirm: 'Valid-pass-123!',
      agreed: true,
    };
    expect(checkOwnerSignUp(goodOwner).ok).toBe(true);
    expect(
      checkOwnerSignUp({ ...goodOwner, venueName: ' ' }).errors.venueName,
    ).toBe('Venue name is required');
    expect(
      checkOwnerSignUp({ ...goodOwner, venueName: 'v'.repeat(61) }).errors
        .venueName,
    ).toBe('Venue name must be between 2 and 60 characters');
    expect(checkOwnerSignUp({ ...goodOwner, agreed: false }).errors.terms).toBe(
      'Please accept the Terms of Use and Privacy Policy',
    );
  });
});

describe('Scrolling to the first problem (firstErrorOffset)', () => {
  const order = ['name', 'email', 'phone', 'terms'];
  const positions = { name: 100, email: 180, phone: 260, terms: 600 };

  test('the first field in order with a problem, minus the margin', () => {
    expect(
      firstErrorOffset(order, { email: 'x', terms: 'y' }, positions, 20),
    ).toBe(160);
    expect(firstErrorOffset(order, { terms: 'y' }, positions, 20)).toBe(580);
  });

  test('never above the top, and nothing when there is no problem or no position yet', () => {
    expect(firstErrorOffset(order, { name: 'x' }, { name: 10 }, 20)).toBe(0);
    expect(firstErrorOffset(order, { name: null }, positions, 20)).toBeNull();
    expect(firstErrorOffset(order, { phone: 'x' }, {}, 20)).toBeNull();
  });
});
