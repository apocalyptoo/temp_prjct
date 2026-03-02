/*
// src/screens/Admin/AdminDashboard.js
import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api/api'; // 

export default function AdminDashboard({ navigation }) {
  const { logout, user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    Alert.alert('Confirm', 'Do you want to logout?', [
      { text: 'Cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  // Fetch system stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const actions = [
    {
      title: 'Manage Users',
      icon: require('../../../assets/icons/player.png'),
      screen: 'ManageUsers',
    },
    {
      title: 'Manage Teams',
      icon: require('../../../assets/icons/myteam.png'),
      screen: 'ManageTeams',
    },
  ];

  return (
    <View style={styles.container}>
      // Header 
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.headerText}>
          Manager Dashboard
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(150)} style={styles.headerName}>
          {user?.name}
        </Animated.Text>
      </LinearGradient>

      //System Summary
      <View style={styles.summaryContainer}>
        {loading ? (
          <ActivityIndicator size="small" color="#3B82F6" />
        ) : (
          <Animated.View entering={FadeInDown.delay(200)} style={styles.summaryBox}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{stats?.userCount ?? 0}</Text>
              <Text style={styles.summaryLabel}>Total Users</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{stats?.teamCount ?? 0}</Text>
              <Text style={styles.summaryLabel}>Total Teams</Text>
            </View>
          </Animated.View>
        )}
      </View>

      //Action Cards
      <FlatList
        data={actions}
        keyExtractor={(item) => item.title}
        numColumns={2}
        contentContainerStyle={styles.grid}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(index * 100)}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#FFFFFF', '#E0F2FE']} style={styles.gradientCard}>
                <Image source={item.icon} style={styles.cardIcon} resizeMode="contain" />
                <Text style={styles.cardText}>{item.title}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      />

      // Floating Logout
      <TouchableOpacity style={styles.floatingButton} onPress={handleLogout}>
        <Image
          source={require('../../../assets/icons/lgout.png')}
          style={styles.floatingIcon}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0F2FE' },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    elevation: 4,
  },
  headerText: {
    fontSize: 20,
    color: '#E0F2FE',
    fontWeight: '400',
    textAlign: 'center',
  },
  headerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
  },
  summaryContainer: {
    alignItems: 'center',
    marginTop: -20,
    marginBottom: 10,
  },
  summaryBox: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '90%',
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 3,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  grid: { paddingVertical: 16, paddingHorizontal: 12 },
  card: {
    width: (Dimensions.get('window').width - 48) / 2,
    borderRadius: 16,
    margin: 8,
    overflow: 'hidden',
    elevation: 3,
  },
  gradientCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    borderRadius: 16,
  },
  cardIcon: { width: 50, height: 50, marginBottom: 8 },
  cardText: { fontSize: 16, fontWeight: '600', color: '#1E3A8A' },
  floatingButton: {
    position: 'absolute',
    bottom: 26,
    right: 26,
    backgroundColor: '#3B82F6',
    borderRadius: 30,
    padding: 14,
    elevation: 5,
  },
  floatingIcon: { width: 28, height: 28, tintColor: '#fff' },
});
*/


import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api/api';

const StatCard = ({ icon, label, value, color = '#1E3A8A' }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconWrapper, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.statValue}>{value ?? 0}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ActionBtn = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient colors={['#FFFFFF', '#a1d3f5ff']} style={styles.actionGradient}>
      <Ionicons name={icon} size={32} color="#1E3A8A" />
      <Text style={styles.actionLabel}>{label}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

export default function AdminDashboard({ navigation }) {
  const { logout, user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err.response?.data || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const onLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchStats(true)} />
      }
    >
      {/* ── Hero Header ── */}
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={40} color="#1E3A8A" />
          </View>
        </View>
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.headerTitle}>
          Admin Dashboard
        </Animated.Text>
        <Text style={styles.headerEmail}>{user?.email}</Text>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#1E3A8A" />
          <Text style={styles.badgeText}>Administrator</Text>
        </View>

        {/* Logout button in header */}
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={16} color="#1E3A8A" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Stats Row ── */}
      <View style={styles.statsRow}>
        {loading ? (
          <ActivityIndicator size="small" color="#1E3A8A" style={{ marginVertical: 20 }} />
        ) : (
          <Animated.View entering={FadeInUp.delay(100)} style={styles.statsInner}>
            <StatCard icon="people-outline" label="Total Users" value={stats?.userCount} />
            <View style={styles.statDivider} />
            <StatCard icon="people-circle-outline" label="Players" value={stats?.playerCount} color="#3B82F6" />
            <View style={styles.statDivider} />
            <StatCard icon="business-outline" label="Owners" value={stats?.ownerCount} color="#10B981" />
            <View style={styles.statDivider} />
            <StatCard icon="shield-outline" label="Teams" value={stats?.teamCount} color="#F59E0B" />
          </Animated.View>
        )}
      </View>

      {/* ── Action Grid ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.actionGrid}>
          <ActionBtn
            icon="people-outline"
            label="Users"
            onPress={() => navigation.navigate('ManageUsers')}
          />
          <ActionBtn
            icon="people-circle-outline"
            label="Teams"
            onPress={() => navigation.navigate('ManageTeams')}
          />
          <ActionBtn
            icon="business-outline"
            label="Indoors"
            onPress={() => navigation.navigate('ManageIndoors')}
          />
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  // Header
  header: {
    paddingTop: 60,
    paddingBottom: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  avatarWrapper: { marginBottom: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerEmail: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  badgeText: { color: '#1E3A8A', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  logoutText: { color: '#1E3A8A', fontWeight: '700', marginLeft: 4 },

  // Stats
  statsRow: {
    marginHorizontal: 16,
    marginTop: -20,
    backgroundColor: '#fff',
    borderRadius: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  statsInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statCard: { alignItems: 'center', flex: 1 },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 10, color: '#888', fontWeight: '600', marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },

  // Actions
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  actionGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 18,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
    marginTop: 8,
  },
});