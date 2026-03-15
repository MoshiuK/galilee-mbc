const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const calendarService = require('../services/calendarService');
const messageService = require('../services/messageService');
const churchMessageService = require('../services/churchMessageService');
const authService = require('../services/authService');

const CATEGORIES = [
  { value: 'worship', label: 'Worship Service' },
  { value: 'bible-study', label: 'Bible Study' },
  { value: 'youth', label: 'Youth Ministry' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'general', label: 'General' }
];

const MSG_CATEGORIES = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'prayer', label: 'Prayer Request' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'update', label: 'Church Update' }
];

// All admin routes require admin or pastor role
router.use(requireRole('admin', 'pastor'));

// Dashboard
router.get('/', (req, res) => {
  const users = authService.getAllUsers();
  const upcomingEvents = calendarService.getUpcoming(5);
  const churchMessages = churchMessageService.getAll(5);

  res.render('layout', {
    title: 'Admin Dashboard',
    view: 'admin/dashboard',
    memberCount: users.length,
    upcomingEvents,
    churchMessages
  });
});

// --- Calendar Management ---

router.get('/calendar', (req, res) => {
  const now = new Date();
  const year = parseInt(req.query.year) || now.getFullYear();
  const month = parseInt(req.query.month) || (now.getMonth() + 1);
  const events = calendarService.getByMonth(year, month);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  res.render('layout', {
    title: 'Manage Calendar',
    view: 'admin/calendar',
    events, year, month,
    monthName: monthNames[month - 1],
    prevMonth, prevYear, nextMonth, nextYear,
    categories: CATEGORIES
  });
});

router.post('/calendar', (req, res) => {
  const { title, description, event_date, start_time, end_time, location, category } = req.body;

  if (!title || !event_date) {
    req.session.flash = { type: 'error', message: 'Title and date are required.' };
    return res.redirect('/admin/calendar');
  }

  calendarService.create({
    title, description, event_date, start_time, end_time, location, category,
    created_by: req.session.user.id
  });

  req.session.flash = { type: 'success', message: 'Event created!' };
  res.redirect('/admin/calendar');
});

router.post('/calendar/:id/update', (req, res) => {
  const { title, description, event_date, start_time, end_time, location, category } = req.body;

  if (!title || !event_date) {
    req.session.flash = { type: 'error', message: 'Title and date are required.' };
    return res.redirect('/admin/calendar');
  }

  calendarService.update(req.params.id, { title, description, event_date, start_time, end_time, location, category });
  req.session.flash = { type: 'success', message: 'Event updated!' };
  res.redirect('/admin/calendar');
});

router.post('/calendar/:id/delete', (req, res) => {
  calendarService.delete(req.params.id);
  req.session.flash = { type: 'success', message: 'Event deleted.' };
  res.redirect('/admin/calendar');
});

// --- Church Messages ---

router.get('/church-messages', (req, res) => {
  const category = req.query.category || '';
  const messages = category
    ? churchMessageService.getByCategory(category)
    : churchMessageService.getAll();

  res.render('layout', {
    title: 'Church Messages',
    view: 'admin/church-messages',
    messages,
    categories: MSG_CATEGORIES,
    activeCategory: category
  });
});

router.post('/church-messages', (req, res) => {
  const { title, body, category, pinned } = req.body;

  if (!title || !body) {
    req.session.flash = { type: 'error', message: 'Title and message are required.' };
    return res.redirect('/admin/church-messages');
  }

  churchMessageService.create({
    sender_id: req.session.user.id,
    title, body,
    category: category || 'announcement',
    pinned: pinned === 'on'
  });

  req.session.flash = { type: 'success', message: 'Message posted!' };
  res.redirect('/admin/church-messages');
});

router.post('/church-messages/:id/pin', (req, res) => {
  churchMessageService.togglePin(req.params.id);
  req.session.flash = { type: 'success', message: 'Pin toggled.' };
  res.redirect('/admin/church-messages');
});

router.post('/church-messages/:id/delete', (req, res) => {
  churchMessageService.delete(req.params.id);
  req.session.flash = { type: 'success', message: 'Message deleted.' };
  res.redirect('/admin/church-messages');
});

// --- Members ---

router.get('/members', (req, res) => {
  const members = authService.getAllUsers();

  res.render('layout', {
    title: 'Manage Members',
    view: 'admin/members',
    members
  });
});

module.exports = router;
