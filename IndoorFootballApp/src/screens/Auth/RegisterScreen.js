import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
} from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onRegister = async () => {
    try {
      const res = await register(name, email.trim(), password);
      Alert.alert('Registered', res?.message || 'Check your email to verify');
      navigation.navigate('Login');
    } catch (err) {
      Alert.alert('Error', err.message || 'Registration failed');
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo Section  */ }
      <View style={styles.logoContainer}>
        <Image
          source={require('../../../assets/icons/ball.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brandName}>ConnectArena</Text>
        <Text style={styles.slogan}>Unleash Your Inner Champion</Text>
      </View>

      {/*  Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.tabText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={[styles.tabText, styles.activeTab]}>Signup</Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Full Name"
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Email"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={onRegister}>
          <Text style={styles.loginButtonText}>Register</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/*
import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
} from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useContext(AuthContext);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('PLAYER');

  const onRegister = async () => {
    try {
      // Basic frontend validation
      if (password !== confirmPassword) {
        return Alert.alert('Error', 'Passwords do not match');
      }

      const res = await register({
        name,
        email: email.trim(),
        password,
        role,
      });

      Alert.alert('Success', res?.message || 'Check your email to verify');
      navigation.navigate('Login');

    } catch (err) {
      Alert.alert('Error', err.message || 'Registration failed');
    }
  };

  return (
    <View style={styles.container}>
      
     
      <View style={styles.logoContainer}>
        <Image
          source={require('../../../assets/icons/ball.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brandName}>ConnectArena</Text>
        <Text style={styles.slogan}>Unleash Your Inner Champion</Text>
      </View>

      
      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleButton, role === 'PLAYER' && styles.roleActive]}
          onPress={() => setRole('PLAYER')}
        >
          <Text style={styles.roleText}>Player</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, role === 'OWNER' && styles.roleActive]}
          onPress={() => setRole('OWNER')}
        >
          <Text style={styles.roleText}>Indoor Owner</Text>
        </TouchableOpacity>
      </View>

     
      <View style={styles.tabContainer}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.tabText}>Login</Text>
        </TouchableOpacity>
        <Text style={[styles.tabText, styles.activeTab]}>Signup</Text>
      </View>

    
      <View style={styles.form}>
        <TextInput
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <TextInput
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          style={styles.input}
        />

        <TouchableOpacity style={styles.loginButton} onPress={onRegister}>
          <Text style={styles.loginButtonText}>Register</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginTop: 8,
  },
  slogan: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '60%',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  tabText: {
    fontSize: 16,
    paddingVertical: 6,
    color: '#777',
    fontWeight: '500',
  },
  activeTab: {
    color: '#000',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 10,
  },
  loginButton: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  roleContainer: {
  flexDirection: 'row',
  marginBottom: 20,
},

roleButton: {
  flex: 1,
  padding: 10,
  borderWidth: 1,
  borderColor: '#ddd',
  alignItems: 'center',
  marginHorizontal: 5,
  borderRadius: 8,
  backgroundColor: '#fff',
},

roleActive: {
  backgroundColor: '#000',
},

roleText: {
  color: '#000',
},

});
*/