
/*
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import api from '../../api/api';

export default function ManageTeamsScreen() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/teams');
      setTeams(res.data || []);
    } catch (err) {
      console.error('Failed to load teams', err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleDelete = (teamId) => {
    Alert.alert('Confirm', 'Delete this team?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(teamId);
            await api.delete(`/admin/teams/${teamId}`);
            await loadTeams();
            Alert.alert('Deleted', 'Team deleted successfully.');
          } catch (err) {
            Alert.alert('Error', 'Failed to delete team');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );

  if (!teams.length)
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No teams found.</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.headerText}>
          Manage Teams
        </Animated.Text>
      </LinearGradient>

      <FlatList
        data={teams}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(index * 100)}>
            <LinearGradient
              colors={['#FFFFFF', '#a1d3f5ff']}
              style={{
                padding: 16,
                borderRadius: 16,
                marginBottom: 12,
                elevation: 2,
              }}
            >
              <Text style={[styles.title, { color: '#1E3A8A' }]}>{item.name}</Text>
              <Text style={[styles.sub, { color: '#333' }]}>
                Owner: {item.owner?.name || item.ownerId}
              </Text>
              <Text style={[styles.date, { color: '#555' }]}>
                Created: {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  { backgroundColor: '#3B82F6', paddingVertical: 8, borderRadius: 10, marginTop: 12 },
                ]}
                onPress={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
              >
                <Text style={[styles.deleteText, { color: '#fff' }]}>
                  {deletingId === item.id ? 'Deleting...' : 'Delete Team'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1E3A8A' },
  sub: { marginTop: 6, color: '#333' },
  date: { marginTop: 4, color: '#666', fontSize: 12 },
  deleteButton: {
    marginTop: 10,
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteText: { color: '#fff', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 16 },
});
*/

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
                    Owner: {item.owner?.name || 'Unknown'}
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