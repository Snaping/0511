const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');

const connectedUsers = new Map();

const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return next(new Error('Authentication error'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    connectedUsers.set(userId, socket.id);

    await User.findByIdAndUpdate(userId, {
      status: 'online',
      lastSeen: Date.now()
    });

    socket.join(userId);
    io.emit('user_status', { userId, status: 'online' });

    socket.on('join_groups', async () => {
      const groups = await Group.find({ 'members.user': socket.user._id });
      groups.forEach(group => {
        socket.join(`group_${group._id}`);
      });
    });

    socket.on('private_message', async (data) => {
      try {
        const { receiverId, content } = data;

        const message = new Message({
          sender: socket.user._id,
          receiver: receiverId,
          content,
          messageType: 'text'
        });

        await message.save();
        await message.populate('sender', 'username displayName avatar status');
        await message.populate('receiver', 'username displayName avatar status');

        const receiverSocketId = connectedUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('private_message', message);
          io.to(receiverSocketId).emit('new_message_notification', {
            from: message.sender,
            content: message.content,
            timestamp: message.createdAt
          });
        }

        socket.emit('message_sent', { messageId: message._id, status: 'sent' });
      } catch (error) {
        console.error('Private message error:', error);
        socket.emit('message_error', { message: 'Failed to send message' });
      }
    });

    socket.on('group_message', async (data) => {
      try {
        const { groupId, content } = data;

        const group = await Group.findById(groupId);
        if (!group || !group.isMember(socket.user._id)) {
          return socket.emit('message_error', { message: 'Access denied' });
        }

        const message = new Message({
          sender: socket.user._id,
          group: groupId,
          content,
          messageType: 'text'
        });

        await message.save();
        await message.populate('sender', 'username displayName avatar status');

        group.lastMessage = message._id;
        await group.save();

        io.to(`group_${groupId}`).emit('group_message', message);
        socket.emit('message_sent', { messageId: message._id, status: 'sent' });
      } catch (error) {
        console.error('Group message error:', error);
        socket.emit('message_error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing', (data) => {
      const { targetId, isTyping, isGroup } = data;

      if (isGroup) {
        socket.to(`group_${targetId}`).emit('user_typing', {
          userId: socket.user._id,
          displayName: socket.user.displayName,
          isTyping,
          isGroup: true,
          groupId: targetId
        });
      } else {
        const targetSocketId = connectedUsers.get(targetId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('user_typing', {
            userId: socket.user._id,
            displayName: socket.user.displayName,
            isTyping,
            isGroup: false
          });
        }
      }
    });

    socket.on('mark_read', async (data) => {
      try {
        const { targetId, isGroup } = data;

        if (isGroup) {
          await Message.updateMany(
            {
              group: targetId,
              isRead: false,
              sender: { $ne: socket.user._id }
            },
            { $set: { isRead: true }, $addToSet: { readBy: socket.user._id } }
          );
        } else {
          await Message.updateMany(
            {
              sender: targetId,
              receiver: socket.user._id,
              isRead: false
            },
            { $set: { isRead: true }, $addToSet: { readBy: socket.user._id } }
          );

          const targetSocketId = connectedUsers.get(targetId);
          if (targetSocketId) {
            io.to(targetSocketId).emit('messages_read', {
              userId: socket.user._id,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    socket.on('user_status_update', async (data) => {
      try {
        const { status } = data;
        await User.findByIdAndUpdate(socket.user._id, { status });
        io.emit('user_status', { userId: socket.user._id, status });
      } catch (error) {
        console.error('Status update error:', error);
      }
    });

    socket.on('disconnect', async () => {
      connectedUsers.delete(userId);

      await User.findByIdAndUpdate(userId, {
        status: 'offline',
        lastSeen: Date.now()
      });

      io.emit('user_status', { userId, status: 'offline', lastSeen: Date.now() });
    });
  });
};

const getConnectedUsers = () => Array.from(connectedUsers.keys());

module.exports = { setupSocket, getConnectedUsers };