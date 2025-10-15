import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { User, Mail, Phone, Key, Lock, Eye, EyeOff } from "lucide-react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from "../../apiConfig";

export default function RegistrationScreen  ({ navigation })  {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    angel_username: "",
    angel_api_key: "",
    angel_password: "",
    angel_token_secret: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = "Full name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ""))) {
      newErrors.phone = "Invalid phone number (10 digits required)";
    }

    if (!formData.angel_username.trim()) {
      newErrors.angel_username = "Angel One username is required";
    }

    if (!formData.angel_api_key.trim()) {
      newErrors.angel_api_key = "API Key is required";
    }

    if (!formData.angel_password.trim()) {
      newErrors.angel_password = "Password is required";
    }

    if (!formData.angel_token_secret.trim()) {
      newErrors.angel_token_secret = "Token Secret is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fill all fields correctly");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Store session token and user info
        await AsyncStorage.setItem("session_token", data.session_token);
        await AsyncStorage.setItem("user_id", data.user_id.toString());
        await AsyncStorage.setItem("full_name", data.full_name);

        Alert.alert(
          "Success",
          "Registration successful! Welcome to Stock Trading App.",
          [
            {
              text: "Continue",
              onPress: () => navigation.replace("StockHome"),
            },
          ]
        );
      } else {
        Alert.alert("Registration Failed", data.error || "Something went wrong");
      }
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert("Error", "Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Enter your Angel One credentials to get started
          </Text>
        </View>

        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputContainer}>
              <User color="#64748b" size={20} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#64748b"
                value={formData.full_name}
                onChangeText={(text) => handleInputChange("full_name", text)}
              />
            </View>
            {errors.full_name && <Text style={styles.errorText}>{errors.full_name}</Text>}
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Mail color="#64748b" size={20} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                placeholderTextColor="#64748b"
                value={formData.email}
                onChangeText={(text) => handleInputChange("email", text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputContainer}>
              <Phone color="#64748b" size={20} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor="#64748b"
                value={formData.phone}
                onChangeText={(text) => handleInputChange("phone", text)}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Angel One Credentials</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Angel Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Angel One Username (Client ID)</Text>
            <View style={styles.inputContainer}>
              <User color="#64748b" size={20} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Your Angel One username"
                placeholderTextColor="#64748b"
                value={formData.angel_username}
                onChangeText={(text) => handleInputChange("angel_username", text)}
                autoCapitalize="none"
              />
            </View>
            {errors.angel_username && <Text style={styles.errorText}>{errors.angel_username}</Text>}
          </View>

          {/* API Key */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>API Key</Text>
            <View style={styles.inputContainer}>
              <Key color="#64748b" size={20} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Angel One API Key"
                placeholderTextColor="#64748b"
                value={formData.angel_api_key}
                onChangeText={(text) => handleInputChange("angel_api_key", text)}
                autoCapitalize="none"
              />
            </View>
            {errors.angel_api_key && <Text style={styles.errorText}>{errors.angel_api_key}</Text>}
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Angel One Password</Text>
            <View style={styles.inputContainer}>
              <Lock color="#64748b" size={20} style={styles.icon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Angel One login password"
                placeholderTextColor="#64748b"
                value={formData.angel_password}
                onChangeText={(text) => handleInputChange("angel_password", text)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff color="#64748b" size={20} />
                ) : (
                  <Eye color="#64748b" size={20} />
                )}
              </TouchableOpacity>
            </View>
            {errors.angel_password && <Text style={styles.errorText}>{errors.angel_password}</Text>}
          </View>

          {/* Token Secret */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>TOTP Token Secret</Text>
            <View style={styles.inputContainer}>
              <Key color="#64748b" size={20} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="TOTP Token Secret (2FA)"
                placeholderTextColor="#64748b"
                value={formData.angel_token_secret}
                onChangeText={(text) => handleInputChange("angel_token_secret", text)}
                autoCapitalize="none"
              />
            </View>
            {errors.angel_token_secret && (
              <Text style={styles.errorText}>{errors.angel_token_secret}</Text>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🔒 Your credentials are securely encrypted and stored. We use industry-standard
              security practices to protect your sensitive information.
            </Text>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.disabledButton]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    lineHeight: 24,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    marginLeft: 4,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#334155",
  },
  dividerText: {
    fontSize: 14,
    color: "#64748b",
    marginHorizontal: 16,
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: "#1e3a5f",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  infoText: {
    fontSize: 13,
    color: "#93c5fd",
    lineHeight: 20,
  },
  registerButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: "#64748b",
    shadowOpacity: 0,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginLinkText: {
    fontSize: 14,
    color: "#94a3b8",
  },
  loginLink: {
    fontSize: 14,
    color: "#3b82f6",
    fontWeight: "600",
  },
});

