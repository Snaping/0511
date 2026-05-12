import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

interface UserState {
  userId: string;
  userName: string;
  setUserName: (name: string) => void;
}

const getStoredUser = () => {
  const stored = localStorage.getItem('gdocs-user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

const initUser = () => {
  const stored = getStoredUser();
  if (stored) return stored;

  const user = {
    userId: uuidv4(),
    userName: `用户${Math.floor(Math.random() * 10000)}`,
  };
  localStorage.setItem('gdocs-user', JSON.stringify(user));
  return user;
};

const initialUser = initUser();

export const useUserStore = create<UserState>((set) => ({
  userId: initialUser.userId,
  userName: initialUser.userName,
  setUserName: (name: string) => {
    set({ userName: name });
    const current = getStoredUser() || {};
    localStorage.setItem('gdocs-user', JSON.stringify({ ...current, userName: name }));
  },
}));
