// Shared by the player and venue owner sign-up forms (docs/features/profiles-and-
// registration.md, section e): the checks run before sending, with the backend's own
// messages where it has one, so each problem shows under its field (the backend still
// checks everything again), and the Terms box with its links.
import React, { useRef } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { API_URL } from '../../api/api';
import { Checkbox, TextLink } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { POSITIONS } from '../../constants/positions';
import {
  cleanPhone,
  isMobileNumber,
  PHONE_RULE_MESSAGE,
} from '../../utils/phone';
import { newPasswordProblem } from '../../utils/password';

// Counts characters as people see them (code points), like the backend, so a Bangla
// name isn't over-counted.
export const charCount = text => [...text].length;

export const PLAYER_NAME = { min: 2, max: 50 };
export const VENUE_NAME = { min: 2, max: 60 };
export const MAX_EMAIL_LENGTH = 254;
export const TERMS_REQUIRED =
  'Please accept the Terms of Use and Privacy Policy';

// Something@something.something, with no spaces. The backend's check is stricter and
// still has the last word ("Please enter a valid email address").
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const between = (text, { min, max }) =>
  charCount(text) >= min && charCount(text) <= max;

// Each returns the field's first problem, or null.

export function nameProblem(name, limits, { required, label }) {
  const trimmed = name.trim();
  if (trimmed === '') return required;
  if (!between(trimmed, limits)) {
    return `${label} must be between ${limits.min} and ${limits.max} characters`;
  }
  return null;
}

export function emailProblem(email) {
  const trimmed = email.trim();
  if (trimmed === '') return 'Email is required';
  if (!EMAIL_SHAPE.test(trimmed)) return 'Please enter a valid email address';
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return `Email must be at most ${MAX_EMAIL_LENGTH} characters`;
  }
  return null;
}

export function phoneProblem(phone) {
  if (phone.trim() === '') return 'Phone number is required';
  return isMobileNumber(cleanPhone(phone)) ? null : PHONE_RULE_MESSAGE;
}

export const positionProblem = position =>
  POSITIONS.includes(position) ? null : 'Choose a position';

export function confirmProblem(password, confirm) {
  if (!confirm) return 'Confirm your password';
  return confirm === password ? null : "Passwords don't match";
}

export const termsProblem = agreed => (agreed ? null : TERMS_REQUIRED);

// Every field's problem (null when fine), and whether there's any.
const result = errors => ({
  errors,
  ok: Object.values(errors).every(problem => problem === null),
});

export function checkPlayerSignUp({
  name,
  email,
  phone,
  position,
  password,
  confirm,
  agreed,
}) {
  return result({
    name: nameProblem(name, PLAYER_NAME, {
      required: 'Name is required',
      label: 'Name',
    }),
    email: emailProblem(email),
    phone: phoneProblem(phone),
    position: positionProblem(position),
    password: newPasswordProblem(password),
    confirm: confirmProblem(password, confirm),
    terms: termsProblem(agreed),
  });
}

export function checkOwnerSignUp({
  venueName,
  email,
  password,
  confirm,
  agreed,
}) {
  return result({
    venueName: nameProblem(venueName, VENUE_NAME, {
      required: 'Venue name is required',
      label: 'Venue name',
    }),
    email: emailProblem(email),
    password: newPasswordProblem(password),
    confirm: confirmProblem(password, confirm),
    terms: termsProblem(agreed),
  });
}

// ── Scrolling to the first problem ──
// The forms are long, so a problem near the top can be off screen when Create account
// is tapped at the bottom. Each field reports where it sits (onLayoutOf), and
// scrollToFirstError scrolls up to the first field with a problem, with a little space
// above it.

// Where to scroll for the first field (in `order`) that has a problem, or null.
export function firstErrorOffset(order, errors, positions, margin) {
  const first = order.find(key => errors[key]);
  if (first === undefined || positions[first] === undefined) return null;
  return Math.max(0, positions[first] - margin);
}

export function useScrollToFirstError(order) {
  const { spacing } = useTheme();
  const scrollRef = useRef(null);
  const positions = useRef({});
  // A field's distance from the top of the form (it must sit directly in the Screen).
  const onLayoutOf = key => event => {
    positions.current[key] = event.nativeEvent.layout.y;
  };
  const scrollToFirstError = errors => {
    const y = firstErrorOffset(order, errors, positions.current, spacing.xl);
    if (y !== null) scrollRef.current?.scrollTo({ y, animated: true });
  };
  return { scrollRef, onLayoutOf, scrollToFirstError };
}

// ── The pieces both forms show ──

// The backend's reply when the account was made but the verification email failed to
// send (backend authController.register). The API has no yes/no field for this, so the
// exact text is matched; Check your email then says so and offers Resend.
export const SEND_FAILED_MESSAGE =
  "Account created, but we couldn't send the verification email. Use 'Resend verification email' on the login screen.";

export const sendFailed = reply => reply?.message === SEND_FAILED_MESSAGE;

// After a successful sign-up: Check your email, with Log in underneath, so Back goes to
// Log in rather than to the filled-in form or the role choice.
export const showCheckEmail = (navigation, email, reply) =>
  navigation.reset({
    index: 1,
    routes: [
      { name: 'Login' },
      { name: 'CheckEmail', params: { email, sendFailed: sendFailed(reply) } },
    ],
  });

// Opens the backend's Terms of Use or Privacy Policy page in the phone's browser.
export async function openLegalPage(page) {
  try {
    await Linking.openURL(`${API_URL}/legal/${page}`);
  } catch {
    Alert.alert(
      "Couldn't open the page",
      'Please check your connection and try again.',
    );
  }
}

// "I agree to the Terms of Use and Privacy Policy." with the two links under it
// (P20: the form's button stays enabled; an unticked box shows its error here).
export function TermsAgreement({ agreed, onChange, error, disabled }) {
  const { spacing } = useTheme();
  return (
    <Checkbox
      checked={agreed}
      onChange={onChange}
      label="I agree to the Terms of Use and Privacy Policy."
      error={error}
      disabled={disabled}
    >
      <View style={[styles.links, { columnGap: spacing.xl }]}>
        <TextLink title="Terms of Use" onPress={() => openLegalPage('terms')} />
        <TextLink
          title="Privacy Policy"
          onPress={() => openLegalPage('privacy')}
        />
      </View>
    </Checkbox>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap' },
});
