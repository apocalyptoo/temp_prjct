// src/screens/Auth/ResetPasswordScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import api from '../../api/api';

export default function ResetPasswordScreen({ navigation }) {
  const [token, setToken] = useState('');
  React.useEffect(() => {
    if (navigation && navigation.getState) {
      const params = navigation.getState().routes.find(r => r.name === 'ResetPassword')?.params;
      if (params && params.token) setToken(params.token);
    }
  }, [navigation]);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!token || !password) return Alert.alert('Error', 'Token and new password required');
    setLoading(true);
    try {
      await api.post('/auth/reset', { token, password });
      Alert.alert('Success', 'Password reset successful. You can now log in.');
      navigation.navigate('Login');
    } catch (err) {
      console.error(err?.response?.data || err.message);
      Alert.alert('Error', err?.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <View style={styles.form}>
        <TextInput
          placeholder="Reset token"
          value={token}
          onChangeText={setToken}
          style={styles.input}
          placeholderTextColor="#aaa"
        />
        <TextInput
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
          placeholderTextColor="#aaa"
        />

        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Set Password'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backContainer}>
          <Text style={styles.backText}>← Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const PRIMARY_COLOR = '#3C6E71';
const ACCENT_COLOR = '#284B63';
const BG_COLOR = '#F1FAFB';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_COLOR, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '700', color: ACCENT_COLOR, marginBottom: 40, textAlign: 'center' },
  form: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 32, paddingHorizontal: 24, elevation: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 16, color: '#333' },
  button: { backgroundColor: PRIMARY_COLOR, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backContainer: { marginTop: 20, alignItems: 'center' },
  backText: { color: PRIMARY_COLOR, fontWeight: '500' },
});
