
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import api from '../../api/api';

export default function ManageTeamsScreen() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadTeams = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.get('/admin/teams');
      setTeams(res.data || []);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to fetch teams');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadTeams(); }, []);

  const deleteTeam = (id, name) => {
    Alert.alert(
      'Delete Team',
      `Are you sure you want to delete "${name}"?\n\nAll team members will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            try {
              await api.delete(`/admin/teams/${id}`);
              await loadTeams();
              Alert.alert('Deleted', 'Team deleted successfully.');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete team');
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
      {/* Header */}
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.headerTitle}>
          Manage Teams
        </Animated.Text>
        <Text style={styles.headerSub}>{teams.length} teams registered</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadTeams(true)} />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.delay(index * 60)}>
              <View style={styles.card}>
                {/* Left icon */}
                <View style={styles.iconWrapper}>
                  <Ionicons name="people-outline" size={22} color="#1E3A8A" />
                </View>

                {/* Info */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.teamName}>{item.name}</Text>
                  {!!item.description && (
                    <Text style={styles.description} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                  <Text style={styles.meta}>
                    Captain: {item.owner?.name || 'Unknown'}
                  </Text>
                  <View style={styles.infoRow}>
                    <View style={styles.memberBadge}>
                      <Ionicons name="people-outline" size={12} color="#3B82F6" />
                      <Text style={styles.memberText}>{item.memberCount} members</Text>
                    </View>
                    <Text style={styles.date}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                {/* Delete button */}
                <TouchableOpacity
                  style={[styles.deleteBtn, deletingId === item.id && styles.deleteBtnDisabled]}
                  onPress={() => deleteTeam(item.id, item.name)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="trash-outline" size={18} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No teams found</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  header: {
    paddingTop: 60,
    paddingBottom: 36,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  list: { padding: 16, paddingBottom: 60 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamName: { fontSize: 15, fontWeight: '700', color: '#111' },
  description: { fontSize: 13, color: '#555', marginTop: 2 },
  meta: { fontSize: 13, color: '#555', marginTop: 2 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  memberText: { fontSize: 11, fontWeight: '700', color: '#3B82F6' },
  date: { fontSize: 11, color: '#888' },
  deleteBtn: {
    backgroundColor: '#EF4444',
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteBtnDisabled: { backgroundColor: '#9CA3AF' },
  empty: { textAlign: 'center', marginTop: 30, color: '#777' },
});