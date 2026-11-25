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
import { useBusyAction } from '../../hooks/useBusyAction';
import {
  AdminDeletionDialog,
  CONFIRM_KEY,
  useAdminDeletion,
} from './adminDeletion';

// The admin's Users tab. Still an old-style screen (moderation rebuilds it); only the
// delete confirmation is new (docs/features/account-deletion.md, Q6).

const roleIcon = role => {
  if (role === 'PLAYER') return 'person-outline';
  if (role === 'OWNER') return 'business-outline';
  return 'shield-outline';
};

const roleColor = role => {
  if (role === 'PLAYER') return '#3B82F6';
  if (role === 'OWNER') return '#10B981';
  return '#F59E0B';
};

export default function ManageUsersScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // The id whose deletion preview is loading, or CONFIRM_KEY (one at a time).
  const { run, busyKey, isBusy } = useBusyAction();

  const loadUsers = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const deletion = useAdminDeletion({
    run,
    onDeleted: async () => {
      await loadUsers();
      Alert.alert('Deleted', 'User deleted successfully.');
    },
    onStale: loadUsers,
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text
          entering={FadeInDown.duration(500)}
          style={styles.headerTitle}
        >
          Manage Users
        </Animated.Text>
        <Text style={styles.headerSub}>{users.length} registered users</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#1E3A8A"
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadUsers(true)}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.delay(index * 60)}>
              <View style={styles.card}>
                {/* Left icon */}
                <View
                  style={[
                    styles.iconWrapper,
                    { backgroundColor: roleColor(item.role) + '20' },
                  ]}
                >
                  <Ionicons
                    name={roleIcon(item.role)}
                    size={22}
                    color={roleColor(item.role)}
                  />
                </View>

                {/* Info */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                  <View style={styles.roleRow}>
                    <View
                      style={[
                        styles.roleBadge,
                        { backgroundColor: roleColor(item.role) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleText,
                          { color: roleColor(item.role) },
                        ]}
                      >
                        {item.role}
                      </Text>
                    </View>
                    {!item.verified && (
                      <View style={styles.unverifiedBadge}>
                        <Text style={styles.unverifiedText}>Unverified</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Delete button: not on ADMIN rows, where it could only be
                    refused (P21) */}
                {item.role !== 'ADMIN' && (
                  <TouchableOpacity
                    style={[
                      styles.deleteBtn,
                      busyKey === item.id && styles.deleteBtnDisabled,
                    ]}
                    onPress={() =>
                      deletion.ask(
                        { path: `/admin/users/${item.id}`, name: item.name },
                        item.id,
                      )
                    }
                    disabled={busyKey === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.name}`}
                  >
                    {busyKey === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No users found</Text>}
        />
      )}

      <AdminDeletionDialog deletion={deletion} loading={isBusy(CONFIRM_KEY)} />
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { fontSize: 15, fontWeight: '700', color: '#111' },
  email: { fontSize: 13, color: '#555', marginTop: 2 },
  roleRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleText: { fontSize: 11, fontWeight: '700' },
  unverifiedBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unverifiedText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
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
