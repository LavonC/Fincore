import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import API_URL from '../config';

const OTPVerificationScreen = ({ route, navigation }) => {
  const { userData } = route.params;
  const [emailOTP, setEmailOTP] = useState('');
  const [phoneOTP, setPhoneOTP] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleVerifyOTP = async () => {
    try {
      setError('');
      setLoading(true);

      if (!emailOTP || !phoneOTP) {
        setError('Please enter both OTPs');
        return;
      }

      if (emailOTP.length !== 6 || phoneOTP.length !== 6) {
        setError('OTP must be 6 digits');
        return;
      }

      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          phone: userData.phone,
          emailOTP,
          phoneOTP,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error verifying OTP');
      }

      // Now create the user account after successful verification
      const signupResponse = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const signupData = await signupResponse.json();

      if (!signupResponse.ok) {
        throw new Error(signupData.error || 'Error creating account');
      }

      Alert.alert('Success', 'Account created successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error) {
      setError(error.message || 'Error verifying OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setResendLoading(true);
      setError('');

      const response = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          phone: userData.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error resending OTP');
      }

      Alert.alert('Success', 'OTP resent successfully!');
      setTimer(60);
      setCanResend(false);
    } catch (error) {
      setError(error.message || 'Error resending OTP');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.header}>
          <Image 
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Verify Your Account</Text>
          <Text style={styles.subtitle}>
            We've sent verification codes to your email and phone number
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email OTP */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email OTP</Text>
            <Text style={styles.hint}>Sent to {userData.email}</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit code"
              placeholderTextColor="#6B7280"
              value={emailOTP}
              onChangeText={setEmailOTP}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          {/* Phone OTP */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone OTP</Text>
            <Text style={styles.hint}>Sent to {userData.phone}</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit code"
              placeholderTextColor="#6B7280"
              value={phoneOTP}
              onChangeText={setPhoneOTP}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          {/* Error Message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Verify Button */}
          <TouchableOpacity 
            style={[styles.verifyButton, loading && styles.buttonDisabled]}
            onPress={handleVerifyOTP}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#1a1f2e" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Resend OTP */}
          <View style={styles.resendContainer}>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOTP} disabled={resendLoading}>
                <Text style={styles.resendLink}>
                  {resendLoading ? 'Sending...' : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timerText}>
                Resend OTP in {timer}s
              </Text>
            )}
          </View>

          {/* Back to Signup */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back to Signup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1f2e',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#273142',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#374151',
    letterSpacing: 4,
    textAlign: 'center',
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
  verifyButton: {
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
  verifyButtonText: {
    color: '#1a1f2e',
    fontSize: 15,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resendLink: {
    color: '#00d4d4',
    fontSize: 14,
    fontWeight: '600',
  },
  timerText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  backButton: {
    alignItems: 'center',
    padding: 10,
  },
  backButtonText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

export default OTPVerificationScreen;
