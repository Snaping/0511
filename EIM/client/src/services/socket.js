import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

let socket = null;

export const connectSocket = (token) => {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    socket.emit('join_groups');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const socketEvents = {
  PRIVATE_MESSAGE: 'private_message',
  GROUP_MESSAGE: 'group_message',
  USER_STATUS: 'user_status',
  USER_TYPING: 'user_typing',
  MESSAGES_READ: 'messages_read',
  NEW_MESSAGE_NOTIFICATION: 'new_message_notification',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_ERROR: 'message_error',
};

export const socketActions = {
  sendPrivateMessage: (receiverId, content) => {
    if (socket) {
      socket.emit('private_message', { receiverId, content });
    }
  },

  sendGroupMessage: (groupId, content) => {
    if (socket) {
      socket.emit('group_message', { groupId, content });
    }
  },

  sendTypingStatus: (targetId, isTyping, isGroup = false) => {
    if (socket) {
      socket.emit('typing', { targetId, isTyping, isGroup });
    }
  },

  markMessagesAsRead: (targetId, isGroup = false) => {
    if (socket) {
      socket.emit('mark_read', { targetId, isGroup });
    }
  },

  updateUserStatus: (status) => {
    if (socket) {
      socket.emit('user_status_update', { status });
    }
  },
};