import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api/api';

export default function AddMemberScreen({ route, navigation }) {
  const { teamId, ownerId } = route.params; // ← ownerId passed from TeamDetail
  const { user } = useContext(AuthContext);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState(null);

  // Guard: if not owner, block immediately
  if (user?.id !== ownerId) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={48} color="#9CA3AF" />
        <Text style={styles.blockedText}>Only the team owner can add members.</Text>
      </View>
    );
  }

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/players');
      setPlayers(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlayers(); }, []);

  const invite = async (userId, playerName) => {
    setInvitingId(userId);
    try {
      await api.post(`/teams/${teamId}/invite`, { userId });
      Alert.alert('Success', `Invite sent to ${playerName}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to invite player');
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.headerTitle}>
          Add Members
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(100)} style={styles.subHeader}>
          Select a player to invite
        </Animated.Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={players}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No players found.</Text>}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.delay(index * 80)}>
              <LinearGradient
                colors={['#FFFFFF', '#a1d3f5ff']}
                style={styles.row}
              >
                <Image
                  source={require('../../../assets/icons/profile.png')}
                  style={styles.avatar}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.inviteButton,
                    invitingId === item.id && styles.inviteButtonDisabled,
                  ]}
                  onPress={() => invite(item.id, item.name)}
                  disabled={invitingId === item.id}
                >
                  {invitingId === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.inviteText}>Invite</Text>
                  }
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  blockedText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '600',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 36,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  subHeader: { fontSize: 13, color: '#E0F2FE', marginTop: 4 },
  list: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
  },
  avatar: { width: 40, height: 40 },
  name: { fontWeight: '700', fontSize: 15, color: '#1E3A8A' },
  email: { color: '#555', fontSize: 13 },
  inviteButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  inviteButtonDisabled: { backgroundColor: '#9CA3AF' },
  inviteText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: '#777', marginTop: 30 },
});