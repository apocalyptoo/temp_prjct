// Create an account: player or venue owner (docs/features/profiles-and-registration.md,
// section e, "Role selection"). Two tappable cards, each opening its sign-up form.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, Icon, Screen, ScreenHeader, Text } from '../../components/ui';

const CHOICES = [
  {
    route: 'PlayerRegister',
    icon: 'teams',
    title: "I'm a player",
    text: 'Join and run teams, and find venues.',
  },
  {
    route: 'OwnerRegister',
    icon: 'venue',
    title: 'I run a venue',
    text: 'List your indoor venue so players can find it.',
  },
];

export default function RoleSelectionScreen({ navigation }) {
  const { colors, spacing } = useTheme();
  return (
    <Screen scroll style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}>
      <ScreenHeader
        back={{ label: 'Log in', onPress: navigation.goBack }}
        title="Create an account"
      />
      {CHOICES.map(choice => (
        <Card
          key={choice.route}
          onPress={() => navigation.navigate(choice.route)}
          accessibilityLabel={`${choice.title}. ${choice.text}`}
        >
          <View style={[styles.row, { gap: spacing.md }]}>
            <Icon name={choice.icon} color={colors.accent} />
            <View style={[styles.words, { gap: spacing.xxs }]}>
              <Text variant="cardTitle">{choice.title}</Text>
              <Text variant="body" color="textMuted">
                {choice.text}
              </Text>
            </View>
            <Icon name="forward" color={colors.textMuted} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  words: { flex: 1 },
});
