const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    const ownerId = req.user._id;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const members = [
      { user: ownerId, role: 'owner' },
      ...(memberIds || []).map(userId => ({ user: userId, role: 'member' }))
    ];

    const group = new Group({
      name,
      description: description || '',
      owner: ownerId,
      members
    });

    await group.save();

    await group.populate('members.user', 'username displayName avatar status');

    res.status(201).json({ group });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const groups = await Group.find({
      'members.user': currentUserId
    })
      .populate('members.user', 'username displayName avatar status')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.json({ groups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members.user', 'username displayName avatar status')
      .populate('owner', 'username displayName avatar status');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const currentUserId = req.user._id;
    if (!group.isMember(currentUserId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ group });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const currentUserId = req.user._id;
    const role = group.getMemberRole(currentUserId);

    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (avatar !== undefined) group.avatar = avatar;

    await group.save();
    await group.populate('members.user', 'username displayName avatar status');

    res.json({ group });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/members', auth, async (req, res) => {
  try {
    const { memberIds } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const currentUserId = req.user._id;
    const role = group.getMemberRole(currentUserId);

    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const existingMemberIds = group.members.map(m => m.user.toString());
    const newMembers = (memberIds || [])
      .filter(userId => !existingMemberIds.includes(userId.toString()))
      .map(userId => ({ user: userId, role: 'member' }));

    group.members.push(...newMembers);
    await group.save();
    await group.populate('members.user', 'username displayName avatar status');

    res.json({ group });
  } catch (error) {
    console.error('Add members error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;
    const currentRole = group.getMemberRole(currentUserId);

    if (targetUserId === currentUserId.toString()) {
      group.members = group.members.filter(m => m.user.toString() !== targetUserId);
      await group.save();
      await group.populate('members.user', 'username displayName avatar status');
      return res.json({ group });
    }

    if (currentRole !== 'owner' && currentRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    group.members = group.members.filter(m => m.user.toString() !== targetUserId);
    await group.save();
    await group.populate('members.user', 'username displayName avatar status');

    res.json({ group });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;