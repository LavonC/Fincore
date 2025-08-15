import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ActivityIndicator 
} from "react-native";
import API_URL from '../config';

export default function LoginPage({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Function to validate email format
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Simulated user database (replace with your actual authentication system)
  const registeredUsers = [
    { email: 'test@example.com', password: 'password123' }
  ];

  return (
    <View style={styles.container}>
      
      <Text style={styles.title}>Login</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        disabled={loading}
        onPress={async () => {
          try {
            setError("");
            setLoading(true);

            // Check if email and password are provided
            if (!email || !password) {
              setError("Please enter both email and password");
              return;
            }

            // Validate email format
            if (!isValidEmail(email)) {
              setError("Please enter a valid email address");
              return;
            }

            // Send login request
            const response = await fetch(`${API_URL}/auth/login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Login failed');
            }

            // If login successful, navigate to AppOpen

            // Reset navigation stack and go to MainApp
            navigation.replace('MainApp');
          } catch (error) {
            setError(error.message || 'Error logging in');
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => navigation.navigate('Signup')}
      >
        <Text style={styles.signupText}>
          Don't have an account? <Text style={styles.signupLink}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
        
    

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6", // gray-100
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2563eb", // blue-600
    marginBottom: 32,
  },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db", // gray-300
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    width: "100%",
    backgroundColor: "#3b82f6", // blue-500
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  signupText: {
    color: "#6b7280", // gray-500
  },
  signupLink: {
    color: "#3b82f6", // blue-500
  },
  errorText: {
    color: "#dc2626", // red-600
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
});