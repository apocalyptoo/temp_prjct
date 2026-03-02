import React, { useContext, useState } from 'react';
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api/api';

export default function TeamDetailScreen({ route, navigation }) {
  const { team } = route.params;
  const { user } = useContext(AuthContext);
  const [removingId, setRemovingId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Check if logged-in user is the team owner
  const isOwner = user?.id === team.ownerId;

  const handleRemovePlayer = (memberId, memberName) => {
    Alert.alert(
      'Remove Player',
      `Are you sure you want to remove "${memberName}" from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(memberId);
            try {
              await api.delete(`/teams/${team.id}/members/${memberId}`);
              Alert.alert('Removed', `${memberName} has been removed from the team.`);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to remove player.');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteTeam = () => {
    Alert.alert(
      'Delete Team',
      `Are you sure you want to delete "${team.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete(`/teams/${team.id}`);
              Alert.alert('Deleted', 'Team has been deleted.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete team.');
              setDeleting(false);
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
          {team.name}
        </Animated.Text>
        {isOwner && (
          <View style={styles.ownerBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#1E3A8A" />
            <Text style={styles.ownerBadgeText}>You are the owner</Text>
          </View>
        )}
      </LinearGradient>

      {/* Team Info Card */}
      <Animated.View entering={FadeInUp.delay(200)} style={styles.infoCard}>
        <Text style={styles.teamDescription}>
          {team.description || 'No description provided.'}
        </Text>

        {/* Owner-only action buttons */}
        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddMember', { teamId: team.id, ownerId: team.ownerId, })}
            >
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.addButtonText}>Add Member</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteTeamButton}
              onPress={handleDeleteTeam}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.deleteTeamText}>Delete Team</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Members List */}
      <FlatList
        data={team.members || []}
        keyExtractor={(m) => String(m.userId || m.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.memberTitle}>
            Members ({team.members?.length || 0})
          </Text>
        }
        renderItem={({ item, index }) => {
          const memberUserId = item.userId || item.user?.id;
          const memberName = item.user?.name || `User ${memberUserId}`;
          const memberEmail = item.user?.email || '';
          const isThisOwner = memberUserId === team.ownerId;

          return (
            <Animated.View entering={FadeInUp.delay(index * 80)}>
              <LinearGradient
                colors={['#FFFFFF', '#a1d3f5ff']}
                style={styles.memberCard}
              >
                <Image
                  source={require('../../../assets/icons/profile.png')}
                  style={styles.avatar}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{memberName}</Text>
                    {isThisOwner && (
                      <View style={styles.captainBadge}>
                        <Text style={styles.captainText}>Owner</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberEmail}>{memberEmail}</Text>
                  <Text style={styles.memberStatus}>{item.status || 'member'}</Text>
                </View>

                {/* Remove button — only owner sees it, and only for non-owner members */}
                {isOwner && !isThisOwner && (
                  <TouchableOpacity
                    style={[
                      styles.removeBtn,
                      removingId === memberUserId && styles.removeBtnDisabled,
                    ]}
                    onPress={() => handleRemovePlayer(memberUserId, memberName)}
                    disabled={removingId === memberUserId}
                  >
                    {removingId === memberUserId
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="person-remove-outline" size={16} color="#fff" />
                    }
                  </TouchableOpacity>
                )}
              </LinearGradient>
            </Animated.View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No members yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  header: {
    paddingTop: 60,
    paddingBottom: 36,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  ownerBadgeText: { color: '#1E3A8A', fontSize: 12, fontWeight: '700', marginLeft: 4 },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginTop: -20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  teamDescription: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 12 },

  ownerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 4 },
  deleteTeamButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  deleteTeamText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 4 },

  list: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  memberTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
  },
  avatar: { width: 40, height: 40 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontWeight: '700', fontSize: 15, color: '#1E3A8A' },
  captainBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  captainText: { fontSize: 10, fontWeight: '700', color: '#1E3A8A' },
  memberEmail: { color: '#555', fontSize: 13, marginTop: 2 },
  memberStatus: { color: '#777', fontSize: 12, marginTop: 2 },
  removeBtn: {
    backgroundColor: '#EF4444',
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeBtnDisabled: { backgroundColor: '#9CA3AF' },
  empty: { textAlign: 'center', color: '#777', marginTop: 20 },
});