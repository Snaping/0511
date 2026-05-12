import React, { useState, useEffect } from 'react';
import { userAPI, groupAPI } from '../services/api';

const CreateGroupModal = ({ onClose, onGroupCreated }) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await userAPI.getUsers();
      setUsers(data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('请输入群组名称');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await groupAPI.createGroup({
        name: groupName.trim(),
        description: description.trim(),
        memberIds: selectedUsers,
      });
      onGroupCreated?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || '创建群组失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>创建新群组</h3>
          <button className="close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label>群组名称 *</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="请输入群组名称"
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label>群组描述</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请输入群组描述（可选）"
                maxLength={200}
              />
            </div>

            <div className="form-group">
              <label>选择成员（可选）</label>
              <div className="member-list" style={{ marginTop: '8px' }}>
                {users.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px' }}>
                    <p>暂无可添加的成员</p>
                  </div>
                ) : (
                  users.map((user) => (
                    <div
                      key={user.id}
                      className={`member-item ${selectedUsers.includes(user.id) ? 'selected' : ''}`}
                      onClick={() => toggleUserSelection(user.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                      />
                      <div className="avatar small">{getInitial(user.displayName || user.username)}</div>
                      <div>
                        <div style={{ fontWeight: 500, color: '#333' }}>
                          {user.displayName || user.username}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{user.email}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !groupName.trim()}
            >
              {loading ? '创建中...' : '创建群组'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;