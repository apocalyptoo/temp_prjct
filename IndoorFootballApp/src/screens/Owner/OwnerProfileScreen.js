import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';

export default function OwnerProfileScreen() {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.get('/owners/me');
      setData(res.data);
    } catch (err) {
      console.error('OwnerProfile load error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  const p = data?.ownerProfile;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
      }
    >
      {/* ── Hero Header ── */}
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="business" size={40} color="#1E3A8A" />
          </View>
        </View>

        <Text style={styles.headerName}>{p?.indoorName || 'Indoor Owner'}</Text>
        <Text style={styles.headerEmail}>{data?.email}</Text>

        <View style={styles.badge}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#1E3A8A" />
          <Text style={styles.badgeText}>Indoor Owner</Text>
        </View>
      </LinearGradient>

      {/* ── Quick Actions ── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('AllTeams')}
        >
          <Ionicons name="people-outline" size={24} color="#1E3A8A" />
          <Text style={styles.actionLabel}>Teams</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Indoors')}
        >
          <Ionicons name="business-outline" size={24} color="#1E3A8A" />
          <Text style={styles.actionLabel}>Indoors</Text>
        </TouchableOpacity>
      </View>

      {/* ── Contact Info Card ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>

        <View style={styles.card}>

          {/* Phone */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Ionicons name="call-outline" size={20} color="#1E3A8A" />
            </View>
            <View>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{p?.phone || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Address */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Ionicons name="location-outline" size={20} color="#1E3A8A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{p?.address || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Email */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Ionicons name="mail-outline" size={20} color="#1E3A8A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{data?.email || 'N/A'}</Text>
            </View>
          </View>

          {/* Website — only shown if present */}
          {!!p?.website && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrapper}>
                  <Ionicons name="globe-outline" size={20} color="#1E3A8A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Website</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(p.website)}>
                    <Text style={styles.websiteValue}>{p.website}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

        </View>
      </View>

      {/* ── About / Description Card ── */}
      {!!p?.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.description}>{p.description}</Text>
          </View>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    paddingTop: 60,
    paddingBottom: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  avatarContainer: { marginBottom: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  headerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  headerEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
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
  badgeText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },

  // Quick Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginTop: -20,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionLabel: { fontSize: 12, color: '#1E3A8A', fontWeight: '600', marginTop: 4 },

  // Sections
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  infoLabel: { fontSize: 11, color: '#888', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#111', fontWeight: '500', marginTop: 2 },

  // Website value (blue + underline to indicate it's tappable)
  websiteValue: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
    marginTop: 2,
    textDecorationLine: 'underline',
  },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 4 },
  description: { color: '#444', lineHeight: 22, paddingVertical: 12 },
});