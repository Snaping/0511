import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eim_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('eim_token');
      localStorage.removeItem('eim_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getCurrentUser: () => api.get('/auth/me'),
};

export const userAPI = {
  getUsers: (search = '') => api.get(`/users?search=${search}`),
  getUser: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
};

export const messageAPI = {
  getPrivateMessages: (userId, page = 1, limit = 50) =>
    api.get(`/messages/private/${userId}?page=${page}&limit=${limit}`),
  getGroupMessages: (groupId, page = 1, limit = 50) =>
    api.get(`/messages/group/${groupId}?page=${page}&limit=${limit}`),
  getConversations: () => api.get('/messages/conversations'),
};

export const groupAPI = {
  createGroup: (data) => api.post('/groups', data),
  getGroups: () => api.get('/groups'),
  getGroup: (id) => api.get(`/groups/${id}`),
  updateGroup: (id, data) => api.put(`/groups/${id}`, data),
  addMembers: (id, memberIds) => api.post(`/groups/${id}/members`, { memberIds }),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
};

export default api;