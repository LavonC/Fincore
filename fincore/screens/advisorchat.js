import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
} from 'react-native';

// Icon components
const ArrowLeftIcon = () => <Text style={styles.icon}>←</Text>;
const AttachIcon = () => <Text style={styles.icon}>📎</Text>;

export default function ChatScreen({ route, navigation }) {
  const { chatId, chatTitle } = route.params || { chatId: '1', chatTitle: 'Financial Advisor' };
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'advisor',
      text: "Hello, I'm here to help with your financial goals. What can I assist you with today?",
    },
    {
      id: '2',
      type: 'user',
      text: "I'm interested in learning more about investment options for retirement.",
    },
    {
      id: '3',
      type: 'advisor',
      text: "Great! We have several options tailored for retirement planning. Let's discuss your risk tolerance and time horizon.",
    },
  ]);

  const sendMessage = () => {
    if (message.trim()) {
      const newMessage = {
        id: (messages.length + 1).toString(),
        type: 'user',
        text: message.trim(),
      };
      setMessages([...messages, newMessage]);
      setMessage('');
      
      // Simulate advisor response after a delay
      setTimeout(() => {
        const advisorResponse = {
          id: (messages.length + 2).toString(),
          type: 'advisor',
          text: "Thank you for your message. I'm processing your request and will provide you with detailed information shortly.",
        };
        setMessages(prev => [...prev, advisorResponse]);
      }, 1000);
    }
  };

  const renderMessage = (msg) => {
    const isAdvisor = msg.type === 'advisor';
    
    return (
      <View key={msg.id} style={[
        styles.messageContainer,
        !isAdvisor && styles.userMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isAdvisor ? styles.advisorBubble : styles.userBubble
        ]}>
          <Text style={styles.messageText}>{msg.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
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
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(renderMessage)}
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
          />
          <TouchableOpacity style={styles.attachButton}>
            <AttachIcon />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={sendMessage}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
  },
  messageContainer: {
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 16,
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
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});