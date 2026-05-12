import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, groupAPI } from '../services/api';

const Sidebar = ({
  activeTab,
  setActiveTab,
  selectedChat,
  onSelectChat,
  onOpenCreateGroup,
  userStatuses,
}) => {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'groups') {
      fetchGroups();
    }
  }, [activeTab]);

  useEffect(() => {
    if (searchQuery && activeTab === 'users') {
      const timer = setTimeout(() => {
        fetchUsers(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  const fetchUsers = async (search = '') => {
    setLoading(true);
    try {
      const { data } = await userAPI.getUsers(search);
      setUsers(data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data } = await groupAPI.getGroups();
      setGroups(data.groups);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setLoading(false);
    }
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

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const renderUsersList = () => {
    if (loading) {
      return <div className="loading">加载中...</div>;
    }

    if (users.length === 0) {
      return (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
          <p>暂无用户</p>
        </div>
      );
    }

    return users.map((u) => {
      const status = userStatuses[u.id] || u.status;
      const isActive = selectedChat?.type === 'user' && selectedChat?.id === u.id;

      return (
        <div
          key={u.id}
          className={`conversation-item ${isActive ? 'active' : ''}`}
          onClick={() => onSelectChat({ type: 'user', ...u })}
        >
          <div className="avatar small">{getInitial(u.displayName || u.username)}</div>
          <div className="conversation-info">
            <div className="conversation-header">
              <span className="conversation-name">{u.displayName || u.username}</span>
              <span className={`status-dot ${getStatusColor(status)}`}></span>
            </div>
            <div className="conversation-preview">{u.email}</div>
          </div>
        </div>
      );
    });
  };

  const renderGroupsList = () => {
    if (loading) {
      return <div className="loading">加载中...</div>;
    }

    if (groups.length === 0) {
      return (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
          <p>暂无群组</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>点击右上角创建新群组</p>
        </div>
      );
    }

    return groups.map((group) => {
      const isActive = selectedChat?.type === 'group' && selectedChat?.id === group._id;

      return (
        <div
          key={group._id}
          className={`conversation-item ${isActive ? 'active' : ''}`}
          onClick={() => onSelectChat({ type: 'group', ...group })}
        >
          <div className="avatar small" style={{ backgroundColor: '#7c3aed' }}>
            {getInitial(group.name)}
          </div>
          <div className="conversation-info">
            <div className="conversation-header">
              <span className="conversation-name">{group.name}</span>
            </div>
            <div className="conversation-preview">
              {group.members?.length || 0} 位成员
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>EIM</h2>
        {activeTab === 'groups' && (
          <button className="icon-btn" onClick={onOpenCreateGroup} title="创建群组">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
        )}
      </div>

      {user && (
        <div className="user-info">
          <div className="avatar">{getInitial(user.displayName || user.username)}</div>
          <div className="user-details">
            <h4>{user.displayName || user.username}</h4>
            <div className="status">
              <span className={`status-dot ${getStatusColor(user.status)}`}></span>
              {user.status === 'online' ? '在线' : user.status === 'offline' ? '离线' : user.status}
            </div>
          </div>
          <button className="logout-btn" onClick={logout} title="退出登录">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
          </button>
        </div>
      )}

      <div className="sidebar-tabs">
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          用户
        </button>
        <button
          className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          群组
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder={activeTab === 'users' ? '搜索用户...' : '搜索群组...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="conversations-list">
        {activeTab === 'users' ? renderUsersList() : renderGroupsList()}
      </div>
    </div>
  );
};

export default Sidebar;