import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  BackHandler,
} from 'react-native';
import API_URL from '../config';

const SignupScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle back button press to exit app
  useEffect(() => {
    const backAction = () => {
      BackHandler.exitApp();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  // Function to validate email format
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check password match in real-time
  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    if (text && password && text !== password) {
      setPasswordError("Passwords don't match");
    } else {
      setPasswordError('');
    }
  };

  const handleSignup = async () => {
    try {
      setError('');
      setLoading(true);

      // Check if all fields are filled
      if (!username || !email || !phone || !password || !confirmPassword) {
        setError('All fields are required');
        return;
      }

      // Validate email format
      if (!isValidEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }

      // Check if passwords match
      if (password !== confirmPassword) {
        setError("Passwords don't match");
        return;
      }

      // Check if email is available
      const checkEmailResponse = await fetch(`${API_URL}/auth/check-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const checkEmailData = await checkEmailResponse.json();

      if (!checkEmailData.isAvailable) {
        setError('This email is already registered');
        return;
      }

      // If all validations pass, proceed with signup
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, phone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error signing up');
      }

      Alert.alert('Success', 'Account created successfully', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error) {
      setError(error.message || 'Error signing up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo and Title */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Text style={styles.logoIcon}>📊</Text>
              </View>
            </View>
            <Text style={styles.title}>Fincore</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#6B7280"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="words"
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor="#6B7280"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#6B7280"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={[styles.input, passwordError && styles.inputError]}
                placeholder="Confirm your password"
                placeholderTextColor="#6B7280"
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry
              />
              {passwordError ? (
                <Text style={styles.passwordErrorText}>{passwordError}</Text>
              ) : null}
            </View>

            {/* Error Message */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Create Account Button */}
            <TouchableOpacity 
              style={[styles.createButton, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1a1f2e" />
              ) : (
                <Text style={styles.createButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1f2e',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    marginBottom: 8,
  },
  logo: {
    width: 50,
    height: 50,
    backgroundColor: '#00d4d4',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#273142',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#374151',
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  passwordErrorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
    backgroundColor: '#2d1f1f',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  createButton: {
    backgroundColor: '#00d4d4',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#1a1f2e',
    fontSize: 15,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  loginLink: {
    color: '#00d4d4',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SignupScreen;