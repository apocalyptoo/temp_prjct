import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api/api';

export default function MyTeamsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadMyTeams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/teams/me');
      setTeams(res.data);
    } catch (err) {
      console.error('loadMyTeams', err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMyTeams(); }, []);

  const handleDelete = (teamId, teamName) => {
    Alert.alert(
      'Delete Team',
      `Are you sure you want to delete "${teamName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(teamId);
            try {
              await api.delete(`/teams/${teamId}`);
              await loadMyTeams();
              Alert.alert('Deleted', 'Team deleted successfully.');
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete team.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.headerTitle}>
          My Teams
        </Animated.Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMyTeams} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>You're not part of any team yet.</Text>
          }
          renderItem={({ item, index }) => {
            const isOwner = user?.id === item.ownerId;
            return (
              <Animated.View entering={FadeInUp.delay(index * 100)}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('TeamDetail', { team: item })}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#FFFFFF', '#a1d3f5ff']} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Image
                        source={require('../../../assets/icons/mtm.png')}
                        style={styles.icon}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.teamName}>{item.name}</Text>
                          {isOwner && (
                            <View style={styles.ownerBadge}>
                              <Text style={styles.ownerBadgeText}>Owner</Text>
                            </View>
                          )}
                        </View>
                        <Text numberOfLines={2} style={styles.teamDescription}>
                          {item.description}
                        </Text>
                        <Text style={styles.meta}>
                          Members: {item.members?.length || 0}
                        </Text>
                      </View>
                    </View>

                    {/* Delete button — only for owner */}
                    {isOwner && (
                      <TouchableOpacity
                        style={[
                          styles.deleteBtn,
                          deletingId === item.id && styles.deleteBtnDisabled,
                        ]}
                        onPress={() => handleDelete(item.id, item.name)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <>
                              <Ionicons name="trash-outline" size={14} color="#fff" />
                              <Text style={styles.deleteBtnText}>Delete Team</Text>
                            </>
                        }
                      </TouchableOpacity>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  list: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 80 },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  icon: { width: 48, height: 48, marginRight: 12, tintColor: '#1E3A8A' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: { fontSize: 16, fontWeight: '700', color: '#1E3A8A' },
  ownerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ownerBadgeText: { fontSize: 10, fontWeight: '700', color: '#1E3A8A' },
  teamDescription: { fontSize: 14, color: '#555', marginTop: 4 },
  meta: { fontSize: 13, color: '#777', marginTop: 4 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 10,
    gap: 6,
  },
  deleteBtnDisabled: { backgroundColor: '#9CA3AF' },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 4 },
  empty: { textAlign: 'center', color: '#777', marginTop: 30 },
});