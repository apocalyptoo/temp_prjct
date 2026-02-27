import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function RoleSelectionScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register As</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('PlayerRegister')}
      >
        <Text style={styles.buttonText}>Player</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('OwnerRegister')}
      >
        <Text style={styles.buttonText}>Indoor Owner</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, marginBottom: 30 },
  button: {
    backgroundColor: '#000',
    padding: 15,
    width: '70%',
    marginVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16 },
});