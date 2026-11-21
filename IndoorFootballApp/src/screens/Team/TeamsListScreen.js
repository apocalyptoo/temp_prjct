// src/screens/Team/TeamsListScreen.js
import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';

export default function TeamsListScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  // Only players can create teams (venue owners also see this screen, read-only).
  const canCreateTeam = user?.role === 'PLAYER';

  // The captain (Team.captainId) is always one of the team's accepted members, and each
  // member already comes with their visible name, so no extra request is needed.
  const captainName = team =>
    team.members?.find(m => m.userId === team.captainId)?.user?.name ||
    'Unknown';

  const loadTeams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/teams');
      setTeams(res.data);
    } catch (err) {
      console.error('loadTeams', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadTeams);
    loadTeams();
    return unsub;
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text
          entering={FadeInDown.duration(500)}
          style={styles.headerTitle}
        >
          All Teams
        </Animated.Text>

        {canCreateTeam && (
          <TouchableOpacity
            style={styles.createButton}
            // Create Team lives in the My Teams tab; initial: false keeps My Teams
            // under it, so going back after creating shows the new team there.
            onPress={() =>
              navigation.navigate('MyTeamsTab', {
                screen: 'CreateTeam',
                initial: false,
              })
            }
          >
            <Text style={styles.createButtonText}>+ Create Team</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Content */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#1E3A8A"
          style={{ marginTop: 30 }}
        />
      ) : (
        <FlatList
          data={teams}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.delay(index * 100)}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('TeamDetail', { teamId: item.id })
                }
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.name}`}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#a1d3f5ff']}
                  style={styles.card} // keep padding, borderRadius, elevation
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image
                      source={require('../../../assets/icons/viewteam.png')}
                      style={styles.icon}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.teamName, { color: '#1E3A8A' }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.teamDescription, { color: '#333' }]}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.meta, { color: '#555' }]}>
                    Captain: {captainName(item)} | Members:{' '}
                    {item.members?.length || 0}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No teams found</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  createButton: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#1E3A8A',
    fontWeight: '700',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  icon: {
    width: 48,
    height: 48,
    marginRight: 12,
    tintColor: '#1E3A8A',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  teamDescription: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    color: '#777',
    marginTop: 8,
  },
  empty: {
    textAlign: 'center',
    color: '#777',
    marginTop: 30,
  },
});
