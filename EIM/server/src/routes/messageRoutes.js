const express = require('express');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/private/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username displayName avatar status')
      .populate('receiver', 'username displayName avatar status');

    const reversedMessages = messages.reverse();

    await Message.updateMany(
      {
        sender: userId,
        receiver: currentUserId,
        isRead: false
      },
      { $set: { isRead: true, $addToSet: { readBy: currentUserId } } }
    );

    res.json({ messages: reversedMessages, page, limit });
  } catch (error) {
    console.error('Get private messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ group: groupId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username displayName avatar status');

    const reversedMessages = messages.reverse();

    await Message.updateMany(
      {
        group: groupId,
        isRead: false,
        sender: { $ne: currentUserId }
      },
      { $addToSet: { readBy: currentUserId } }
    );

    res.json({ messages: reversedMessages, page, limit });
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/conversations', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: currentUserId },
            { receiver: currentUserId }
          ],
          group: null
        }
      },
      {
        $project: {
          otherUser: {
            $cond: [
              { $eq: ['$sender', currentUserId] },
              '$receiver',
              '$sender'
            ]
          },
          content: 1,
          createdAt: 1,
          isRead: 1,
          sender: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$otherUser',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$sender', '$otherUser'] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const user = await Message.populate(conv.lastMessage.otherUser, {
          path: 'otherUser',
          model: 'User',
          select: 'username displayName avatar status lastSeen'
        });

        return {
          user,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount
        };
      })
    );

    res.json({ conversations: populatedConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;