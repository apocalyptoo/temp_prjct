// Shared by the venue screens (docs/features/venues.md, section e): My Venue, the venue
// list and Venue detail. Opening a website or the dialler, the Website row, and the
// opening hours on one line.
import React from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Divider, Icon, ListRow, Text, TextLink } from '../../components/ui';
import { isWebLink } from '../../utils/links';
import { NOT_ADDED } from '../Player/PlayerProfileScreen';

// Opens a website that passed isWebLink in the phone's browser.
export async function openWebsite(website) {
  try {
    await Linking.openURL(website);
  } catch {
    Alert.alert("Couldn't open the link", 'Please try again.');
  }
}

// Opens the phone's dialler with the number filled in (Venue detail's Phone row).
export async function openDialler(phone) {
  try {
    await Linking.openURL(`tel:${phone}`);
  } catch {
    Alert.alert("Couldn't open the dialler", 'Please try again.');
  }
}

// "Sat–Thu 8am–2am · Fri 2pm–2am": opening hours typed on several lines, joined into
// one line for a venue card. It still wraps at large font sizes rather than being cut.
export const hoursOnOneLine = hours =>
  String(hours ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .join(' · ');

// The Website row: like the other rows, but a real http(s) link (isWebLink) is a
// TextLink that opens the browser; anything else is plain text, never opened. An empty
// website says "Not added" (My Venue; Venue detail leaves the row out instead).
export function WebsiteRow({ website, last = false }) {
  const { colors, spacing, touchTarget } = useTheme();
  if (!website || !isWebLink(website)) {
    return (
      <ListRow
        icon="website"
        name="Website"
        meta={website || NOT_ADDED}
        last={last}
      />
    );
  }
  return (
    <View>
      <View
        style={[
          styles.row,
          {
            minHeight: touchTarget,
            paddingVertical: spacing.md,
            gap: spacing.md,
          },
        ]}
      >
        <Icon name="website" color={colors.textMuted} />
        <View style={styles.middle}>
          <Text variant="bodyStrong">Website</Text>
          <TextLink
            title={website}
            onPress={() => openWebsite(website)}
            accessibilityLabel={`Website, ${website}`}
            style={styles.linkStart}
          />
        </View>
      </View>
      {last ? null : <Divider />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  middle: { flex: 1 },
  linkStart: { alignItems: 'flex-start' },
});
