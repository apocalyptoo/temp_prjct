import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api/api';

const SettingsItem = ({ icon, label, sublabel, onPress, color = '#1E3A8A', danger = false, loading = false }) => (
  <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7} disabled={loading}>
    <View style={[styles.itemIconWrapper, danger && styles.itemIconDanger]}>
      <Ionicons name={icon} size={20} color={danger ? '#EF4444' : color} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.itemLabel, danger && { color: '#EF4444' }]}>{label}</Text>
      {!!sublabel && <Text style={styles.itemSublabel}>{sublabel}</Text>}
    </View>
    {loading
      ? <ActivityIndicator size="small" color="#1E3A8A" />
      : <Ionicons name="chevron-forward" size={16} color="#ccc" />
    }
  </TouchableOpacity>
);

export default function OwnerSettingsScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const [resetLoading, setResetLoading] = useState(false);

  // ── Logout ──
  const onLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  // ── Change Password (Option A) ──
  const onChangePassword = () => {
    Alert.alert(
      'Change Password',
      'We will send a password reset link to:\n\n' + user?.email,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            setResetLoading(true);
            try {
              await api.post('/auth/forgot', { email: user?.email });

              Alert.alert(
                'Email Sent ✅',
                'A password reset link has been sent to ' +
                  user?.email +
                  '.\n\nCheck your inbox and follow the link to set a new password.'
              );
            } catch (err) {
              Alert.alert(
                'Error',
                err.response?.data?.error || 'Failed to send reset email. Try again.'
              );
            } finally {
              setResetLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* ── Header ── */}
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>{user?.email}</Text>
      </LinearGradient>

      {/* ── Account Section ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <SettingsItem
            icon="person-outline"
            label="Profile"
            sublabel="View your profile info"
            onPress={() => navigation.navigate('OwnerProfile')}
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="lock-closed-outline"
            label="Change Password"
            sublabel="A reset link will be sent to your email"
            onPress={onChangePassword}
            loading={resetLoading}
          />
        </View>
      </View>

      {/* ── App Section ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.card}>
          <SettingsItem
            icon="information-circle-outline"
            label="About ConnectArena"
            sublabel="Version 1.0.0"
            onPress={() =>
              Alert.alert(
                'ConnectArena',
                'Version 1.0.0\nBuilt for indoor football communities.'
              )
            }
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="help-circle-outline"
            label="Support"
            sublabel="Get help or report an issue"
            onPress={() =>
              Alert.alert('Support', 'Contact us at support@connectarena.com')
            }
          />
        </View>
      </View>

      {/* ── Session Section ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session</Text>
        <View style={styles.card}>
          <SettingsItem
            icon="log-out-outline"
            label="Logout"
            sublabel="Sign out of your account"
            onPress={onLogout}
            danger
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
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },

  // Sections
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },

  // Item
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  itemIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  itemIconDanger: { backgroundColor: '#FEF2F2' },
  itemLabel: { fontSize: 15, fontWeight: '600', color: '#111' },
  itemSublabel: { fontSize: 12, color: '#888', marginTop: 2 },
});