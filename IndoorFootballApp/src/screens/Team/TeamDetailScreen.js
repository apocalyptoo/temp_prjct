import React, { useCallback, useContext, useEffect, useState } from 'react';
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
  const { user } = useContext(AuthContext);
  // Starts as the team passed in from My Teams, then is reloaded from the backend.
  const [team, setTeam] = useState(route.params.team);
  const [removingId, setRemovingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const teamId = route.params.team.id;

  // Reloads this team. The screen is only opened from My Teams, so the viewer is the
  // captain or a member, and /teams/me includes it (with pendingInvites for the captain).
  // If it's no longer there (deleted, or you were removed), go back.
  const loadTeam = useCallback(async () => {
    try {
      const res = await api.get('/teams/me');
      const fresh = res.data.find(t => t.id === teamId);
      if (fresh) {
        setTeam(fresh);
      } else {
        Alert.alert(
          'Team not available',
          'This team no longer exists, or you are no longer in it.',
        );
        navigation.goBack();
      }
    } catch (err) {
      console.error('loadTeam', err?.response?.data || err.message);
    }
  }, [navigation, teamId]);

  // Reload whenever the screen comes into view (for example back from Add Member).
  useEffect(
    () => navigation.addListener('focus', loadTeam),
    [navigation, loadTeam],
  );

  // Check if logged-in user is the team's captain (Team.ownerId)
  const isOwner = user?.id === team.ownerId;

  // `members` holds accepted members only. The backend adds `pendingInvites` only for
  // the captain; they're listed after the members (labelled "pending") but not counted.
  const members = team.members || [];
  const listedPeople = [...members, ...(team.pendingInvites || [])];

  // Removes a member, or cancels a pending invite (same backend call), then reloads.
  const handleRemovePlayer = (memberId, memberName, isPendingInvite) => {
    Alert.alert(
      isPendingInvite ? 'Cancel Invite' : 'Remove Player',
      isPendingInvite
        ? `Cancel the invite to "${memberName}"?`
        : `Are you sure you want to remove "${memberName}" from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isPendingInvite ? 'Cancel Invite' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(memberId);
            try {
              await api.delete(`/teams/${team.id}/members/${memberId}`);
              Alert.alert(
                isPendingInvite ? 'Invite cancelled' : 'Removed',
                isPendingInvite
                  ? `The invite to ${memberName} has been cancelled.`
                  : `${memberName} has been removed from the team.`,
              );
              await loadTeam();
            } catch (err) {
              Alert.alert(
                'Error',
                err.response?.data?.error || 'Failed to remove player.',
              );
            } finally {
              setRemovingId(null);
            }
          },
        },
      ],
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
              Alert.alert(
                'Error',
                err.response?.data?.error || 'Failed to delete team.',
              );
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text
          entering={FadeInDown.duration(500)}
          style={styles.headerTitle}
        >
          {team.name}
        </Animated.Text>
        {isOwner && (
          <View style={styles.ownerBadge}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color="#1E3A8A"
            />
            <Text style={styles.ownerBadgeText}>You are the captain</Text>
          </View>
        )}
      </LinearGradient>

      {/* Team Info Card */}
      <Animated.View entering={FadeInUp.delay(200)} style={styles.infoCard}>
        <Text style={styles.teamDescription}>
          {team.description || 'No description provided.'}
        </Text>

        {/* Captain-only action buttons */}
        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() =>
                navigation.navigate('AddMember', {
                  teamId: team.id,
                  ownerId: team.ownerId,
                })
              }
            >
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.addButtonText}>Add Member</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteTeamButton}
              onPress={handleDeleteTeam}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                  <Text style={styles.deleteTeamText}>Delete Team</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Members List */}
      <FlatList
        data={listedPeople}
        keyExtractor={m => String(m.userId || m.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.memberTitle}>Members ({members.length})</Text>
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
                        <Text style={styles.captainText}>Captain</Text>
                      </View>
                    )}
                  </View>
                  {!!memberEmail && (
                    <Text style={styles.memberEmail}>{memberEmail}</Text>
                  )}
                  <Text style={styles.memberStatus}>
                    {item.status || 'member'}
                  </Text>
                </View>

                {/* Remove button — only the captain sees it, and not on their own row */}
                {isOwner && !isThisOwner && (
                  <TouchableOpacity
                    style={[
                      styles.removeBtn,
                      removingId === memberUserId && styles.removeBtnDisabled,
                    ]}
                    onPress={() =>
                      handleRemovePlayer(
                        memberUserId,
                        memberName,
                        item.status === 'pending',
                      )
                    }
                    disabled={removingId === memberUserId}
                  >
                    {removingId === memberUserId ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons
                        name="person-remove-outline"
                        size={16}
                        color="#fff"
                      />
                    )}
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
  ownerBadgeText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },

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
  teamDescription: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
  },

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
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 4,
  },
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
  deleteTeamText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 4,
  },

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
