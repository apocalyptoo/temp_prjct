// Developer-only: every shared component in its states, plus two small mock-ups to
// compare with docs/design/. Reachable only in development (__DEV__): AuthStack
// registers it and the Login screen links to it only then, and the release bundle
// doesn't include this file at all (see AuthStack.js).
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Avatar,
  BackLink,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  NoticeLine,
  Pill,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
  TextField,
  TextLink,
} from '../../components/ui';
import { ICON_NAMES } from '../../components/ui/Icon';

const FAKE_REQUEST_MS = 2000;

const TRICKY_NAMES = [
  'Nayeem Islam',
  'rahim',
  '   Fahim    Rahman  ',
  'Rahim Uddin Ahmed',
  'রাকিব হাসান',
  'ক্ষমা',
  '👍🏽 Fan',
  '👨‍👩‍👧 Family',
  '🇧🇩 Tigers',
  '',
];

function Section({ title, children }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="section" color="textMuted" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ children }) {
  const { spacing } = useTheme();
  return <View style={[styles.row, { gap: spacing.md }]}>{children}</View>;
}

// Like the first card in docs/design/floodlight-my-teams.png (made-up data).
function TeamCardMock() {
  const { spacing } = useTheme();
  return (
    <Card
      onPress={() => {}}
      accessibilityLabel="Open Dhanmondi Strikers"
      style={{ gap: spacing.cardGap }}
    >
      <View style={[styles.row, styles.noWrap, { gap: spacing.md }]}>
        <Avatar name="Dhanmondi Strikers" size="large" />
        <View style={styles.fill}>
          <Text variant="cardTitle">Dhanmondi Strikers</Text>
          <Text variant="meta" color="textMuted">
            11 / 15 members
          </Text>
        </View>
        <Pill label="Captain" variant="strong" />
      </View>
      <Text variant="bodySmall" color="textMuted">
        Weekend 5-a-side crew. Friendly but competitive.
      </Text>
      <Divider />
      <NoticeLine strong="2 join requests" text="waiting for you" />
    </Card>
  );
}

// Like the "Join requests" card in docs/design/floodlight-team-detail-captain.png
// (made-up data; positions use the real list, not the mockup's futsal terms).
function JoinRequestsMock() {
  const { spacing } = useTheme();
  const requests = [
    { name: 'Nayeem Islam', meta: 'Forward · Mohammadpur' },
    { name: 'Fahim Rahman', meta: 'Defender · Dhanmondi' },
  ];
  return (
    <Card>
      <SectionHeader title="Join requests" right={<Pill label="2 new" />} />
      {requests.map((request, index) => (
        <ListRow
          key={request.name}
          name={request.name}
          meta={request.meta}
          last={index === requests.length - 1}
          trailing={
            <View style={[styles.row, styles.noWrap, { gap: spacing.sm }]}>
              <IconButton
                variant="reject"
                accessibilityLabel={`Reject ${request.name}`}
                onPress={() => {}}
              />
              <IconButton
                variant="approve"
                accessibilityLabel={`Approve ${request.name}`}
                onPress={() => {}}
              />
            </View>
          }
        />
      ))}
    </Card>
  );
}

function CaptainLabel() {
  const { colors, spacing, icon } = useTheme();
  return (
    <View style={[styles.row, styles.noWrap, { gap: spacing.xxs }]}>
      <Icon name="captain" size={icon.sizeSmall} color={colors.accent} />
      <Text variant="buttonSecondary" color="accent">
        Captain
      </Text>
    </View>
  );
}

export default function UIGalleryScreen({ navigation }) {
  const { spacing, typography } = useTheme();
  const [email, setEmail] = useState('not-an-email');
  const [password, setPassword] = useState('secret-pass');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [buttonBusy, setButtonBusy] = useState(false);

  const fakeRequest = setBusy => done => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      done?.();
    }, FAKE_REQUEST_MS);
  };

  return (
    <Screen scroll keyboardAware edges={['top', 'bottom']}>
      <View style={{ gap: spacing.xxxl, paddingVertical: spacing.xl }}>
        <ScreenHeader
          back={{ label: 'Login', onPress: () => navigation.goBack() }}
          title="UI gallery"
        />

        <Section title="Mock-up: team card">
          <TeamCardMock />
        </Section>

        <Section title="Mock-up: join requests">
          <JoinRequestsMock />
        </Section>

        <Section title="Text styles">
          {Object.keys(typography).map(variant => (
            <Text key={variant} variant={variant}>
              {variant}: Dhanmondi Strikers
            </Text>
          ))}
        </Section>

        <Section title="Buttons">
          <Row>
            <Button title="Create team" icon="add" />
            <Button title="Secondary" variant="secondary" />
            <Button title="Delete" variant="danger" icon="delete" />
          </Row>
          <Row>
            <Button title="Loading" loading />
            <Button title="Loading" variant="secondary" loading />
            <Button title="Loading" variant="danger" loading />
          </Row>
          <Row>
            <Button title="Disabled" disabled />
            <Button title="Disabled" variant="secondary" disabled />
          </Row>
          <Button
            title="Tap for a 2-second fake request"
            fullWidth
            loading={buttonBusy}
            onPress={() => fakeRequest(setButtonBusy)()}
          />
          <Row>
            <Button
              title="Invite players"
              style={styles.fill}
              onPress={() => {}}
            />
            <Button
              title="Transfer captaincy"
              variant="secondary"
              style={styles.fill}
              onPress={() => {}}
            />
          </Row>
        </Section>

        <Section title="Icon buttons">
          <Row>
            <IconButton
              variant="approve"
              accessibilityLabel="Approve"
              onPress={() => {}}
            />
            <IconButton
              variant="reject"
              accessibilityLabel="Reject"
              onPress={() => {}}
            />
            <IconButton
              icon="settings"
              accessibilityLabel="Settings"
              onPress={() => {}}
            />
            <IconButton
              variant="approve"
              accessibilityLabel="Approve (disabled)"
              disabled
            />
          </Row>
        </Section>

        <Section title="Pills and badges">
          <Row>
            <Pill label="Captain" variant="strong" />
            <Pill label="Player" />
            <Pill label="11 / 15 members" />
            <Pill label="2 new" />
          </Row>
          <Row>
            <Text color="textMuted">0 →</Text>
            <Badge count={0} />
            <Badge count={3} />
            <Badge count={42} />
            <Badge count={99} />
            <Badge count={120} />
          </Row>
        </Section>

        <Section title="Avatars">
          <Row>
            {TRICKY_NAMES.map(name => (
              <Avatar key={`small-${name}`} name={name} />
            ))}
          </Row>
          <Row>
            {TRICKY_NAMES.map(name => (
              <Avatar key={`large-${name}`} name={name} size="large" />
            ))}
          </Row>
        </Section>

        <Section title="List rows">
          <Card>
            <SectionHeader
              title="Members"
              right={<TextLink title="See all 11" onPress={() => {}} />}
            />
            <ListRow
              name="Rahim Uddin"
              meta="Midfielder"
              trailing={<CaptainLabel />}
            />
            <ListRow name="Tanvir Ahmed" meta="Goalkeeper" onPress={() => {}} />
            <ListRow name="Sakib Hasan" meta="Forward" last />
          </Card>
        </Section>

        <Section title="Text fields">
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={email.includes('@') ? undefined : 'Enter a valid email'}
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secure
            helper="At least 8 characters"
          />
          <TextField
            label="Area"
            placeholder="For example Dhanmondi"
            helper="Not your full address"
          />
          <TextField label="Disabled" value="Can't edit this" disabled />
        </Section>

        <Section title="Notices, links and empty state">
          <NoticeLine strong="2 join requests" text="waiting for you" />
          <NoticeLine
            strong="A much longer notice"
            text="that wraps onto a second line to check the dot stays on the first line"
          />
          <BackLink label="My Teams" onPress={() => {}} />
          <Card>
            <EmptyState
              message="You're not in a team yet."
              actionTitle="Create team"
              actionIcon="add"
              onAction={() => {}}
            />
          </Card>
        </Section>

        <Section title="Confirmation dialog">
          <Button
            title="Delete team…"
            variant="danger"
            icon="delete"
            onPress={() => setDialogOpen(true)}
          />
          <ConfirmDialog
            visible={dialogOpen}
            title="Delete Dhanmondi Strikers?"
            message="Everyone in the team loses it. This can't be undone. (Fake: waits 2 seconds, then closes.)"
            confirmTitle="Delete team"
            destructive
            loading={dialogBusy}
            onConfirm={() =>
              fakeRequest(setDialogBusy)(() => setDialogOpen(false))
            }
            onCancel={() => setDialogOpen(false)}
          />
        </Section>

        <Section title={`Icons (${ICON_NAMES.length})`}>
          <View style={[styles.row, { gap: spacing.lg }]}>
            {ICON_NAMES.map(name => (
              <View key={name} style={[styles.iconCell, { gap: spacing.xxs }]}>
                <Icon name={name} />
                <Text variant="meta" color="textMuted">
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  noWrap: { flexWrap: 'nowrap' },
  fill: { flex: 1 },
  iconCell: { alignItems: 'center' },
});
