// Explore → Venues, until feature 3b (docs/features/venues.md, section e, D1 and P19):
// a "Venues" header with a back link to Explore, and the venue list. Feature 3b puts the
// same VenueList into the real Explore and this screen goes away.
import React from 'react';
import { Screen, ScreenHeader } from '../../components/ui';
import VenueList from './VenueList';

export default function VenuesScreen({ navigation }) {
  return (
    <Screen>
      <VenueList
        navigation={navigation}
        header={
          <ScreenHeader
            back={{ label: 'Explore', onPress: navigation.goBack }}
            title="Venues"
          />
        }
      />
    </Screen>
  );
}
