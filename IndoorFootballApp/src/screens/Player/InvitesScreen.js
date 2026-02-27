
// src/screens/Invites/InvitesScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import api from '../../api/api';

export default function InvitesScreen() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const res = await api.get('/players/invites');
      setInvites(res.data);
    } catch (err) {
      console.error('loadInvites', err?.response?.data || err.message);
      Alert.alert('Error', 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async (teamId) => {
    try {
      await api.post(`/teams/${teamId}/accept`);
      Alert.alert('Joined', 'You have joined the team.');
      loadInvites();
    } catch (err) {
      console.error('acceptInvite', err?.response?.data || err.message);
      const msg = err?.response?.data?.error || 'Failed to accept invite';
      Alert.alert('Error', msg);
    }
  };

  const rejectInvite = async (teamId) => {
    try {
      await api.post(`/teams/${teamId}/reject`);
      Alert.alert('Rejected', 'Invite rejected.');
      loadInvites();
    } catch (err) {
      console.error('rejectInvite', err?.response?.data || err.message);
      const msg = err?.response?.data?.error || 'Failed to reject invite';
      Alert.alert('Error', msg);
    }
  };

  useEffect(() => {
    loadInvites();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.headerTitle}>
          Team Invites
        </Animated.Text>
      </LinearGradient>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={invites}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.delay(index * 100)}>
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image
                    source={require('../../../assets/icons/inv.png')}
                    style={styles.icon}
                  />
                  <View>
                    <Text style={styles.teamName}>
                      {item.team?.name || `Team ${item.teamId}`}
                    </Text>
                    <Text style={styles.status}>Status: {item.status}</Text>
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.accept]}
                    onPress={() => acceptInvite(item.teamId)}
                  >
                    <Text style={styles.buttonText}>Accept</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.reject]}
                    onPress={() => rejectInvite(item.teamId)}
                  >
                    <Text style={styles.buttonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No pending invites</Text>}
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
    elevation: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
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
  status: {
    fontSize: 14,
    color: '#555',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  accept: {
    backgroundColor: '#3B82F6',
    marginRight: 8,
  },
  reject: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    marginTop: 30,
    color: '#777',
  },
});
