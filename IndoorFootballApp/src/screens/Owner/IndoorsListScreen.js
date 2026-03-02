import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../../api/api';

export default function IndoorsListScreen() {
  const [indoors, setIndoors] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/owners');
      setIndoors(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Text style={styles.headerTitle}>Registered Indoors</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} size="large" color="#1E3A8A" />
      ) : (
        <FlatList
          data={indoors}
          keyExtractor={(i) => String(i.userId)}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.indoorName}</Text>
              <Text style={styles.meta}>{item.email}</Text>
              <Text style={styles.meta}>{item.phone}</Text>
              <Text style={styles.meta}>{item.address}</Text>
              {!!item.description && <Text style={styles.meta}>{item.description}</Text>}
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30 }}>No indoors found</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingTop: 60, paddingBottom: 40, paddingHorizontal: 20,
    borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, elevation: 3 },
  title: { fontWeight: '800', color: '#1E3A8A', fontSize: 16, marginBottom: 6 },
  meta: { color: '#333', marginTop: 2 },
});