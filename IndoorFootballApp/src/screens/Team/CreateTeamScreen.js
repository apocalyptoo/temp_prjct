// src/screens/Team/CreateTeamScreen.js
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import api from '../../api/api';

export default function CreateTeamScreen({ navigation }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const onCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Team name is required.');
      return;
    }
    try {
      const res = await api.post('/teams/create', { name, description });
      Alert.alert(
        'Team Created',
        `Team "${res.data.name}" created successfully.`,
      );
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Error',
        err?.response?.data?.error || 'Failed to create team',
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={styles.header}>
        <Animated.Text
          entering={FadeInDown.duration(500)}
          style={styles.headerTitle}
        >
          Create Team
        </Animated.Text>
      </LinearGradient>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          placeholder="Team name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholderTextColor="#888"
        />
        <TextInput
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          style={[styles.input, { height: 100 }]}
          placeholderTextColor="#888"
          multiline
        />

        <TouchableOpacity style={styles.button} onPress={onCreate}>
          <Text style={styles.buttonText}>Create</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  form: {
    flex: 1,
    padding: 20,
    marginTop: 30,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#111',
    marginBottom: 16,
    elevation: 2,
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
