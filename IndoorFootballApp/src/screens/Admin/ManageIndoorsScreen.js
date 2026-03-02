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

export default function ManageIndoorsScreen() {
  const [indoors, setIndoors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadIndoors = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.get('/admin/indoors');
      setIndoors(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load indoor fields.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadIndoors(); }, []);

  const deleteIndoor = (userId, name) => {
    Alert.alert(
      'Delete Indoor',
      `Are you sure you want to delete "${name}"?\n\nThis will permanently delete the owner account and all associated data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(userId);
            try {
              await api.delete(`/admin/indoors/${userId}`);
              await loadIndoors();
              Alert.alert('Deleted', 'Indoor field deleted successfully.');
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete indoor.');
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
          Manage Indoors
        </Animated.Text>
        <Text style={styles.headerSub}>{indoors.length} registered indoor fields</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={indoors}
          keyExtractor={(i) => String(i.userId)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadIndoors(true)} />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.delay(index * 60)}>
              <View style={styles.card}>
                {/* Left icon */}
                <View style={styles.iconWrapper}>
                  <Ionicons name="business-outline" size={22} color="#10B981" />
                </View>

                {/* Info */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.indoorName}>{item.indoorName}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                  <Text style={styles.meta}>{item.phone}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{item.address}</Text>
                  {!item.verified && (
                    <View style={styles.unverifiedBadge}>
                      <Text style={styles.unverifiedText}>Unverified</Text>
                    </View>
                  )}
                </View>

                {/* Delete button */}
                <TouchableOpacity
                  style={[styles.deleteBtn, deletingId === item.userId && styles.deleteBtnDisabled]}
                  onPress={() => deleteIndoor(item.userId, item.indoorName)}
                  disabled={deletingId === item.userId}
                >
                  {deletingId === item.userId
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="trash-outline" size={18} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No indoor fields found</Text>
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
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indoorName: { fontSize: 15, fontWeight: '700', color: '#111' },
  email: { fontSize: 13, color: '#555', marginTop: 2 },
  meta: { fontSize: 12, color: '#777', marginTop: 2 },
  unverifiedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
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