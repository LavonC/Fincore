import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';

// Icon components (you'd typically use react-native-vector-icons)
const ArrowLeftIcon = () => <Text style={styles.icon}>←</Text>;
const UserIcon = () => <Text style={styles.icon}>👤</Text>;
const CloseIcon = () => <Text style={styles.icon}>✕</Text>;

export default function FinancialAdvisorScreen({ navigation }) {
  const [chats, setChats] = useState([
    {
      id: '1',
      title: 'Investment Strategies',
      preview: "Hi, I'm interested in learning more about...",
    },
    {
      id: '2',
      title: 'Retirement Planning',
      preview: "I'm looking for advice on retirement planning...",
    },
    {
      id: '3',
      title: 'Home Savings',
      preview: 'What are the best options for saving for a down...',
    },
  ]);

  const deleteChat = (id) => {
    setChats(chats.filter((chat) => chat.id !== id));
  };

  const openChat = (chat) => {
    navigation.navigate('AdvisorChat', { 
      chatId: chat.id, 
      chatTitle: chat.title 
    });
  };

  const createNewChat = () => {
    const newChatId = (Math.max(...chats.map(c => parseInt(c.id)), 0) + 1).toString();
    const newChat = {
      id: newChatId,
      title: `Chat ${newChatId}`,
      preview: 'Start a new conversation...',
    };
    setChats([newChat, ...chats]);
    navigation.navigate('AdvisorChat', { 
      chatId: newChat.id, 
      chatTitle: newChat.title 
    });
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => openChat(item)}
    >
      <View style={styles.chatContent}>
        <Text style={styles.chatTitle}>{item.title}</Text>
        <Text style={styles.chatPreview}>{item.preview}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteChat(item.id)}
      >
        <CloseIcon />
      </TouchableOpacity>
    </TouchableOpacity>
  );

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
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* New Chat Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.newChatButton}
          onPress={createNewChat}
        >
          <Text style={styles.newChatButtonText}>New Chat</Text>
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