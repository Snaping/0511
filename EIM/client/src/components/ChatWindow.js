import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { messageAPI } from '../services/api';
import { socketActions, socketEvents } from '../services/socket';

const ChatWindow = ({ chat, userStatuses }) => {
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (chat) {
      fetchMessages();
    }
  }, [chat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket || !chat) return;

    const handlePrivateMessage = (message) => {
      if (chat.type === 'user') {
        const otherId = chat.id || chat._id;
        if (
          (message.sender._id === user.id && message.receiver._id === otherId) ||
          (message.sender._id === otherId && message.receiver._id === user.id)
        ) {
          setMessages((prev) => [...prev, message]);
        }
      }
    };

    const handleGroupMessage = (message) => {
      if (chat.type === 'group' && message.group === (chat.id || chat._id)) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const handleUserTyping = (data) => {
      if (data.isGroup && chat.type === 'group') {
        if (data.groupId === (chat.id || chat._id) && data.userId !== user.id) {
          setTypingUsers((prev) => {
            if (data.isTyping && !prev.includes(data.userId)) {
              return [...prev, data.userId];
            } else if (!data.isTyping) {
              return prev.filter((id) => id !== data.userId);
            }
            return prev;
          });
        }
      } else if (!data.isGroup && chat.type === 'user') {
        if (data.userId === (chat.id || chat._id)) {
          setTypingUsers(data.isTyping ? [data.userId] : []);
        }
      }
    };

    socket.on(socketEvents.PRIVATE_MESSAGE, handlePrivateMessage);
    socket.on(socketEvents.GROUP_MESSAGE, handleGroupMessage);
    socket.on(socketEvents.USER_TYPING, handleUserTyping);

    return () => {
      socket.off(socketEvents.PRIVATE_MESSAGE, handlePrivateMessage);
      socket.off(socketEvents.GROUP_MESSAGE, handleGroupMessage);
      socket.off(socketEvents.USER_TYPING, handleUserTyping);
    };
  }, [socket, chat, user]);

  const fetchMessages = async () => {
    if (!chat) return;

    setLoading(true);
    try {
      const chatId = chat.id || chat._id;
      let response;

      if (chat.type === 'user') {
        response = await messageAPI.getPrivateMessages(chatId);
      } else {
        response = await messageAPI.getGroupMessages(chatId);
      }

      setMessages(response.data.messages);

      if (chat.type === 'user') {
        socketActions.markMessagesAsRead(chatId, false);
      } else {
        socketActions.markMessagesAsRead(chatId, true);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chat) return;

    const chatId = chat.id || chat._id;

    if (chat.type === 'user') {
      socketActions.sendPrivateMessage(chatId, newMessage.trim());
      socketActions.sendTypingStatus(chatId, false, false);
    } else {
      socketActions.sendGroupMessage(chatId, newMessage.trim());
      socketActions.sendTypingStatus(chatId, false, true);
    }

    setNewMessage('');
    setTypingUsers([]);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    if (chat && socket) {
      const chatId = chat.id || chat._id;
      socketActions.sendTypingStatus(chatId, value.length > 0, chat.type === 'group');
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const getStatusColor = (status) => {
    const statusMap = {
      online: 'online',
      offline: 'offline',
      busy: 'busy',
      away: 'away',
    };
    return statusMap[status] || 'offline';
  };

  if (!chat) {
    return (
      <div className="main-content">
        <div className="no-chat-selected">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
          <p>选择一个用户或群组开始聊天</p>
        </div>
      </div>
    );
  }

  const chatName = chat.displayName || chat.name || chat.username;
  const chatId = chat.id || chat._id;

  return (
    <div className="main-content">
      <div className="chat-header">
        <div
          className="avatar small"
          style={{ backgroundColor: chat.type === 'group' ? '#7c3aed' : '#1a73e8' }}
        >
          {getInitial(chatName)}
        </div>
        <h3>{chatName}</h3>
        {chat.type === 'user' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              className={`status-dot ${getStatusColor(userStatuses[chatId] || chat.status)}`}
            ></span>
            <span style={{ fontSize: '12px', color: '#666' }}>
              {userStatuses[chatId] === 'online' || chat.status === 'online' ? '在线' : '离线'}
            </span>
          </div>
        )}
        {chat.type === 'group' && (
          <span style={{ fontSize: '12px', color: '#666' }}>
            {chat.members?.length || 0} 位成员
          </span>
        )}
      </div>

      <div className="messages-container">
        {loading ? (
          <div className="loading">加载消息中...</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <p>暂无消息，发送第一条消息吧！</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const senderId = msg.sender?._id || msg.sender;
            const isOwn = senderId === user.id;
            const senderName = msg.sender?.displayName || msg.sender?.username || '';

            return (
              <div key={msg._id || index} className={`message ${isOwn ? 'own' : ''}`}>
                {!isOwn && chat.type === 'group' && (
                  <div className="avatar small">{getInitial(senderName)}</div>
                )}
                <div className="message-content">
                  {!isOwn && chat.type === 'group' && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#1a73e8',
                        marginBottom: '2px',
                        fontWeight: 500,
                      }}
                    >
                      {senderName}
                    </div>
                  )}
                  <div className="message-text">{msg.content}</div>
                  <div className="message-time">{formatTime(msg.createdAt)}</div>
                </div>
              </div>
            );
          })
        )}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <span>
              {chat.type === 'group' ? '有人' : chatName} 正在输入
            </span>
            <div className="dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-container" onSubmit={handleSendMessage}>
        <textarea
          className="message-input"
          placeholder="输入消息..."
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
          rows={1}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!newMessage.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatWindow;