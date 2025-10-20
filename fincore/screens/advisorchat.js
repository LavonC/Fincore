import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_ENDPOINTS } from '../apiConfig';

// Icon components
const ArrowLeftIcon = () => <Text style={styles.icon}>←</Text>;
const AttachIcon = () => <Text style={styles.icon}>📎</Text>;

export default function ChatScreen({ route, navigation }) {
  const { chatId, chatTitle } = route.params || { chatId: '1', chatTitle: 'Financial Advisor' };
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const scrollViewRef = useRef(null);

  useEffect(() => {
    loadUserAndMessages();
  }, [chatId]);

  const loadUserAndMessages = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        Alert.alert('Error', 'Please login to use advisor');
        navigation.navigate('Login');
        return;
      }
      setUserEmail(email);
      await loadMessages();
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      console.log('📥 Loading messages for chat:', chatId);
      
      const response = await axios.post(API_ENDPOINTS.ADVISOR_LIST_MESSAGES, {
        chatId: chatId
      });

      if (response.data.success) {
        setMessages(response.data.messages || []);
        console.log(`✅ Loaded ${response.data.count} message(s)`);
        setTimeout(() => scrollToBottom(), 100);
      } else {
        throw new Error(response.data.error || 'Failed to load messages');
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error.message);
      Alert.alert('Error', 'Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    
    const userMessage = message.trim();
    const tempUserMsgId = `temp_user_${Date.now()}`;
    const tempAIMsgId = `temp_ai_${Date.now()}`;
    
    // Clear input and show user message immediately
    setMessage('');
    
    // Add user message to UI immediately
    const userMsgObj = {
      id: tempUserMsgId,
      type: 'user',
      text: userMessage,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsgObj]);
    setTimeout(() => scrollToBottom(), 100);
    
    // Show typing indicator
    const typingMsg = {
      id: tempAIMsgId,
      type: 'advisor',
      text: '',
      isTyping: true,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, typingMsg]);
    setTimeout(() => scrollToBottom(), 100);
    setSending(true);

    try {
      console.log('📤 Sending message:', userMessage);
      
      const response = await axios.post(API_ENDPOINTS.ADVISOR_SEND_MESSAGE, {
        email: userEmail,
        chatId: chatId,
        message: userMessage
      });

      console.log('✅ Message sent:', response.data);

      if (response.data.success) {
        // Remove temporary messages and add real ones
        setMessages(prev => {
          // Remove temp user message and typing indicator
          const filtered = prev.filter(m => m.id !== tempUserMsgId && m.id !== tempAIMsgId);
          // Add real messages from server
          return [
            ...filtered,
            response.data.userMessage,
            response.data.aiMessage
          ];
        });
        
        setTimeout(() => scrollToBottom(), 100);

        if (response.data.contextUsed) {
          console.log('💡 Financial context was used in response');
        }
      } else {
        throw new Error(response.data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error.message);
      // Remove temporary messages on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMsgId && m.id !== tempAIMsgId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
      // Restore message in input
      setMessage(userMessage);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = (msg) => {
    const isAdvisor = msg.type === 'advisor';
    const isTyping = msg.isTyping || false;
    
    // Clean markdown and split text into lines
    const renderFormattedText = (text) => {
      if (!text) return null;
      
      // Remove markdown symbols
      let cleanedText = text
        .replace(/####\s*/g, '') // Remove #### headers
        .replace(/###\s*/g, '')  // Remove ### headers
        .replace(/##\s*/g, '')   // Remove ## headers
        .replace(/#\s*/g, '')    // Remove # headers
        .replace(/\|\s*:---:\s*\|/g, '') // Remove table dividers |:---:|
        .replace(/\|/g, '')      // Remove remaining pipes
        .replace(/\*\*/g, '')    // Remove bold **
        .replace(/\*/g, '')      // Remove italics *
        .replace(/__/g, '')      // Remove bold __
        .replace(/_/g, '');      // Remove italics _
      
      return cleanedText.split('\n').map((line, index) => {
        // Skip empty lines from markdown cleanup
        if (line.trim() === '') {
          return <Text key={index}>{'\n'}</Text>;
        }
        
        // Check if line is a bullet point
        const isBullet = line.trim().startsWith('•');
        // Check if line is a numbered item
        const isNumbered = /^\[?\d+\]/.test(line.trim());
        
        return (
          <Text 
            key={index} 
            style={[
              styles.messageText,
              isBullet && styles.bulletPoint,
              isNumbered && styles.numberedItem
            ]}
          >
            {line}
            {index < cleanedText.split('\n').length - 1 && '\n'}
          </Text>
        );
      });
    };
    
    return (
      <View key={msg.id} style={[
        styles.messageContainer,
        !isAdvisor && styles.userMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isAdvisor ? styles.advisorBubble : styles.userBubble,
          isTyping && styles.typingBubble
        ]}>
          {isTyping ? (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingDot}>●</Text>
              <Text style={styles.typingDot}>●</Text>
              <Text style={styles.typingDot}>●</Text>
            </View>
          ) : (
            <View>{renderFormattedText(msg.text)}</View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16A085" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeftIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{chatTitle}</Text>
          <View style={styles.backButton} />
        </View>

        {/* Messages */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom()}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>👋</Text>
              <Text style={styles.emptyStateText}>
                Hi! I'm your financial advisor AI. Ask me anything about budgeting, saving, investing, or your financial goals!
              </Text>
            </View>
          ) : (
            messages.map(renderMessage)
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              placeholderTextColor="#6B7280"
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={sendMessage}
              multiline
              maxLength={1000}
              editable={!sending}
            />
            <TouchableOpacity 
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={sending || !message.trim()}
            >
              <Text style={styles.sendButtonText}>
                {sending ? 'Sending...' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  icon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  messageContainer: {
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  loadingMessageContainer: {
    opacity: 0.7,
  },
  loadingMessageText: {
    color: '#FFFFFF',
    marginLeft: 8,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingBubble: {
    paddingVertical: 12,
  },
  advisorBubble: {
    backgroundColor: '#2F4F4F',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#16A085',
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  bulletPoint: {
    paddingLeft: 8,
    lineHeight: 26,
  },
  numberedItem: {
    paddingLeft: 4,
    lineHeight: 26,
    fontWeight: '500',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    fontSize: 20,
    color: '#16A085',
    marginHorizontal: 2,
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2F4F4F',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 12,
    minHeight: 48,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButton: {
    backgroundColor: '#16A085',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
    justifyContent: 'center',
    minWidth: 80,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#4A5568',
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});