
// Example client-side code for connecting to WebSocket
// This would typically be in your frontend application

const io = require('socket.io-client');

class ChatClient {
  constructor(token) {
    this.socket = io('http://localhost:3000', {
      auth: {
        token: token
      }
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Chat events
    this.socket.on('new_message', (data) => {
      console.log('New message received:', data);
      // Update UI with new message
    });

    this.socket.on('user_typing', (data) => {
      console.log('User typing:', data);
      // Show typing indicator
    });

    this.socket.on('user_stopped_typing', (data) => {
      console.log('User stopped typing:', data);
      // Hide typing indicator
    });

    this.socket.on('user_status_changed', (data) => {
      console.log('User status changed:', data);
      // Update user status in UI
    });

    this.socket.on('notification', (notification) => {
      console.log('Notification received:', notification);
      // Show notification
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  // Join a conversation
  joinConversation(conversationId) {
    this.socket.emit('join_conversation', conversationId);
  }

  // Leave a conversation
  leaveConversation(conversationId) {
    this.socket.emit('leave_conversation', conversationId);
  }

  // Send a message
  sendMessage(conversationId, content, messageType = 'TEXT', attachedData = null) {
    this.socket.emit('send_message', {
      conversationId,
      content,
      messageType,
      attachedData
    });
  }

  // Start typing
  startTyping(conversationId) {
    this.socket.emit('typing_start', conversationId);
  }

  // Stop typing
  stopTyping(conversationId) {
    this.socket.emit('typing_stop', conversationId);
  }

  // Mark messages as read
  markMessagesRead(conversationId) {
    this.socket.emit('mark_messages_read', conversationId);
  }

  // Update user status
  updateStatus(status) {
    this.socket.emit('update_user_status', status);
  }
}

// Usage example:
// const client = new ChatClient('your-jwt-token');
// client.joinConversation('conversation-id');
// client.sendMessage('conversation-id', 'Hello there!');

module.exports = ChatClient;
