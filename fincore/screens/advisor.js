import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_ENDPOINTS } from '../apiConfig';

// Icon components
const ArrowLeftIcon = () => <Text style={styles.icon}>←</Text>;
const UserIcon = () => <Text style={styles.icon}>👤</Text>;
const CloseIcon = () => <Text style={styles.icon}>✕</Text>;

export default function FinancialAdvisorScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    loadUserAndChats();
    
    const unsubscribe = navigation.addListener('focus', () => {
      // Only reload if we already have userEmail set
      if (userEmail) {
        loadChats(userEmail);
      }
    });
    
    return unsubscribe;
  }, [navigation]);

  const loadUserAndChats = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        Alert.alert('Error', 'Please login to use advisor');
        navigation.navigate('Login');
        return;
      }
      setUserEmail(email);
      await loadChats(email);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const loadChats = async (email = userEmail) => {
    try {
      // Guard: Don't make request if no email
      if (!email) {
        console.log('⚠️ Skipping loadChats - no email available yet');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      setLoading(true);
      console.log('📥 Loading chats for:', email);
      
      const response = await axios.post(API_ENDPOINTS.ADVISOR_LIST_CHATS, {
        email: email
      });

      if (response.data.success) {
        setChats(response.data.chats || []);
        console.log(`✅ Loaded ${response.data.count} chat(s)`);
      } else {
        throw new Error(response.data.error || 'Failed to load chats');
      }
    } catch (error) {
      console.error('❌ Error loading chats:', error.message);
      if (error.response?.status === 404) {
        Alert.alert('Session Expired', 'Please login again', [
          { text: 'OK', onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert('Error', 'Failed to load chats. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  const createNewChat = async () => {
    try {
      console.log('🆕 Creating new chat...');
      
      const response = await axios.post(API_ENDPOINTS.ADVISOR_CREATE_CHAT, {
        email: userEmail,
        title: 'New Chat'
      });

      if (response.data.success) {
        const newChat = response.data.chat;
        setChats([newChat, ...chats]);
        navigation.navigate('AdvisorChat', {
          chatId: newChat.id,
          chatTitle: newChat.title
        });
      } else {
        throw new Error(response.data.error || 'Failed to create chat');
      }
    } catch (error) {
      console.error('❌ Error creating chat:', error.message);
      Alert.alert('Error', 'Failed to create new chat. Please try again.');
    }
  };

  const deleteChat = async (chatId) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await axios.post(API_ENDPOINTS.ADVISOR_DELETE_CHAT, {
                email: userEmail,
                chatId: chatId
              });

              if (response.data.success) {
                setChats(chats.filter((chat) => chat.id !== chatId));
                Alert.alert('Success', 'Chat deleted successfully');
              } else {
                throw new Error(response.data.error || 'Failed to delete chat');
              }
            } catch (error) {
              console.error('❌ Error deleting chat:', error.message);
              Alert.alert('Error', 'Failed to delete chat. Please try again.');
            }
          }
        }
      ]
    );
  };

  const openChat = (chat) => {
    navigation.navigate('AdvisorChat', {
      chatId: chat.id,
      chatTitle: chat.title
    });
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => openChat(item)}
    >
      <View style={styles.chatContent}>
        <Text style={styles.chatTitle}>{item.title}</Text>
        <Text style={styles.chatPreview} numberOfLines={2}>
          {item.preview || 'Start a new conversation...'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={(e) => {
          e.stopPropagation();
          deleteChat(item.id);
        }}
      >
        <CloseIcon />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>💬</Text>
      <Text style={styles.emptyStateTitle}>No Chats Yet</Text>
      <Text style={styles.emptyStateText}>
        Start a new conversation with your financial advisor
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22D3EE" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeftIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Advisor</Text>
        <TouchableOpacity style={styles.headerButton}>
          <UserIcon />
        </TouchableOpacity>
      </View>

      {/* Chats Section */}
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Chats</Text>
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            chats.length === 0 ? styles.emptyListContainer : styles.chatList
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#22D3EE"
              colors={['#22D3EE']}
            />
          }
        />
      </View>

      {/* New Chat Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={createNewChat}
        >
          <Text style={styles.newChatButtonText}>+ New Chat</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
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
    paddingVertical: 20,
  },
  headerButton: {
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  chatList: {
    paddingBottom: 16,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  chatContent: {
    flex: 1,
    marginRight: 12,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  chatPreview: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 16,
  },
  newChatButton: {
    backgroundColor: '#22D3EE',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});