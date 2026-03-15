const express = require('express');
const router = express.Router();
const messageService = require('../services/messageService');
const authService = require('../services/authService');
const { requireLogin } = require('../middleware/auth');

// All message routes require login
router.use(requireLogin);

// Inbox
router.get('/', (req, res) => {
  const tab = req.query.tab || 'inbox';
  const messages = tab === 'sent'
    ? messageService.getSent(req.session.user.id)
    : messageService.getInbox(req.session.user.id);

  res.render('layout', {
    title: 'Messages',
    view: 'messages/inbox',
    messages,
    tab
  });
});

// Compose form
router.get('/compose', (req, res) => {
  const users = authService.getAllUsers().filter(u => u.id !== req.session.user.id);
  res.render('layout', {
    title: 'New Message',
    view: 'messages/compose',
    users,
    replyTo: req.query.to || '',
    replySubject: req.query.subject || ''
  });
});

// Send message
router.post('/', (req, res) => {
  const { recipient_id, subject, body } = req.body;

  if (!recipient_id || !subject || !body) {
    req.session.flash = { type: 'error', message: 'All fields are required.' };
    return res.redirect('/messages/compose');
  }

  messageService.send({
    sender_id: req.session.user.id,
    recipient_id: parseInt(recipient_id),
    subject,
    body
  });

  req.session.flash = { type: 'success', message: 'Message sent!' };
  res.redirect('/messages');
});

// Conversation with a user
router.get('/conversation/:userId', (req, res) => {
  const otherUserId = parseInt(req.params.userId);
  const otherUser = authService.findById(otherUserId);

  if (!otherUser) {
    req.session.flash = { type: 'error', message: 'User not found.' };
    return res.redirect('/messages');
  }

  const messages = messageService.getConversation(req.session.user.id, otherUserId);

  res.render('layout', {
    title: `Conversation with ${otherUser.full_name}`,
    view: 'messages/conversation',
    messages,
    otherUser
  });
});

// Reply in conversation
router.post('/conversation/:userId', (req, res) => {
  const { subject, body } = req.body;
  const recipientId = parseInt(req.params.userId);

  if (!subject || !body) {
    req.session.flash = { type: 'error', message: 'Subject and message are required.' };
    return res.redirect(`/messages/conversation/${recipientId}`);
  }

  messageService.send({
    sender_id: req.session.user.id,
    recipient_id: recipientId,
    subject,
    body
  });

  req.session.flash = { type: 'success', message: 'Reply sent!' };
  res.redirect(`/messages/conversation/${recipientId}`);
});

module.exports = router;
