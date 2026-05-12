import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import CreateGroupModal from './CreateGroupModal';
import { socketEvents } from '../services/socket';

const ChatPage = () => {
  const { socket } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [selectedChat, setSelectedChat] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [userStatuses, setUserStatuses] = useState({});

  useEffect(() => {
    if (!socket) return;

    const handleUserStatus = (data) => {
      setUserStatuses((prev) => ({
        ...prev,
        [data.userId]: data.status,
      }));
    };

    socket.on(socketEvents.USER_STATUS, handleUserStatus);

    return () => {
      socket.off(socketEvents.USER_STATUS, handleUserStatus);
    };
  }, [socket]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
  };

  const handleGroupCreated = () => {
    setActiveTab('groups');
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedChat={selectedChat}
        onSelectChat={handleSelectChat}
        onOpenCreateGroup={() => setShowCreateGroup(true)}
        userStatuses={userStatuses}
      />
      <ChatWindow chat={selectedChat} userStatuses={userStatuses} />

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  );
};

export default ChatPage;