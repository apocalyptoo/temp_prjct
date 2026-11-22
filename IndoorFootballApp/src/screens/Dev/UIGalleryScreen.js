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
  Checkbox,
  ConfirmDialog,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  NoticeLine,
  OptionGroup,
  Pill,
  Screen,
  ScreenHeader,
  SectionHeader,
  SuggestionField,
  TabBar,
  Text,
  TextField,
  TextLink,
} from '../../components/ui';
import { ICON_NAMES } from '../../components/ui/Icon';
import { INITIALS_METHOD } from '../../components/ui/Avatar';
import { POSITIONS } from '../../constants/positions';
import { suggestAreas } from '../../constants/areas';

const FAKE_REQUEST_MS = 2000;

// Names that test the initials rule (DESIGN.md section 6, Avatar).
const TRICKY_NAMES = [
  'Nayeem Islam',
  'rahim',
  '   Fahim    Rahman  ',
  'Rahim Uddin Ahmed',
  'রাহাত হাসান',
  'ক্ষমা',
  '🇧🇩 Tanvir Ahmed',
  '👍🏽 Fahim',
  'Rahim ⚽ Uddin',
  '10 Rahim Uddin',
  '👨‍👩‍👧',
  '',
];

// A player's tabs, with a stand-in for React Navigation so the bar can be tried here.
const GALLERY_TABS = [
  { name: 'MyTeamsTab', title: 'My Teams', icon: 'teams' },
  { name: 'ExploreTab', title: 'Explore', icon: 'explore' },
  { name: 'NotificationsTab', title: 'Notifications', icon: 'notifications' },
  { name: 'ProfileTab', title: 'Profile', icon: 'profile' },
];
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

function GalleryTabBar({ badge, initialIndex = 0 }) {
  const [index, setIndex] = useState(initialIndex);
  const routes = GALLERY_TABS.map(tab => ({ key: tab.name, name: tab.name }));
  const descriptors = Object.fromEntries(
    GALLERY_TABS.map(tab => [
      tab.name,
      {
        options: {
          title: tab.title,
          tabBarIconName: tab.icon,
          tabBarBadge: tab.name === 'NotificationsTab' ? badge : undefined,
        },
      },
    ]),
  );
  const navigation = {
    emit: () => ({ defaultPrevented: false }),
    dispatch: action => {
      const next = routes.findIndex(r => r.name === action.payload?.name);
      if (next >= 0) setIndex(next);
    },
  };
  return (
    <TabBar
      state={{ key: 'gallery-tabs', index, routes }}
      descriptors={descriptors}
      navigation={navigation}
      insets={NO_INSETS}
    />
  );
}

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
  const [agreed, setAgreed] = useState(false);
  const [position, setPosition] = useState(null);
  const [area, setArea] = useState('');

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

        <Section title="Tab bar">
          <GalleryTabBar />
          <GalleryTabBar badge={3} initialIndex={2} />
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
          <Text variant="meta" color="textMuted">
            Whole characters found with: {INITIALS_METHOD}
          </Text>
          {TRICKY_NAMES.map(name => (
            <View
              key={name || 'empty'}
              style={[styles.row, styles.noWrap, { gap: spacing.md }]}
            >
              <Avatar name={name} />
              <Avatar name={name} size="large" />
              <Text variant="meta" color="textMuted" style={styles.fill}>
                {name ? `"${name}"` : '(empty name)'}
              </Text>
            </View>
          ))}
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

        <Section title="Checkbox">
          <Checkbox
            checked={agreed}
            onChange={setAgreed}
            label="I agree to the Terms of Use and Privacy Policy."
            error={
              agreed
                ? undefined
                : 'Please accept the Terms of Use and Privacy Policy'
            }
          >
            <Row>
              <TextLink title="Terms of Use" onPress={() => {}} />
              <TextLink title="Privacy Policy" onPress={() => {}} />
            </Row>
          </Checkbox>
          <Checkbox checked label="Ticked" onChange={() => {}} />
          <Checkbox checked={false} label="Disabled" disabled />
        </Section>

        <Section title="Option group">
          <OptionGroup
            label="Position"
            options={POSITIONS}
            value={position}
            onChange={setPosition}
            error={position ? undefined : 'Choose a position'}
          />
          <OptionGroup
            label="Disabled"
            options={POSITIONS}
            value="Forward"
            disabled
          />
        </Section>

        <Section title="Suggestion field">
          <SuggestionField
            label="Area (optional)"
            value={area}
            onChangeText={setArea}
            getSuggestions={suggestAreas}
            placeholder="Try “pur” or “m”"
            helper="Your neighbourhood, like Dhanmondi. Don't enter your full address."
          />
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
