const express = require('express');
const router = express.Router();
const calendarService = require('../services/calendarService');
const { requireLogin, requireRole } = require('../middleware/auth');

const CATEGORIES = [
  { value: 'worship', label: 'Worship Service' },
  { value: 'bible-study', label: 'Bible Study' },
  { value: 'youth', label: 'Youth Ministry' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'general', label: 'General' }
];

// Monthly calendar view
router.get('/', (req, res) => {
  const now = new Date();
  const year = parseInt(req.query.year) || now.getFullYear();
  const month = parseInt(req.query.month) || (now.getMonth() + 1);

  const events = calendarService.getByMonth(year, month);

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Map events by day
  const eventsByDay = {};
  events.forEach(e => {
    const day = parseInt(e.event_date.split('-')[2]);
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(e);
  });

  res.render('layout', {
    title: 'Church Calendar',
    view: 'calendar/index',
    year, month, daysInMonth, startDow, eventsByDay,
    monthName: monthNames[month - 1],
    prevMonth, prevYear, nextMonth, nextYear
  });
});

// New event form
router.get('/new', requireRole('admin', 'pastor'), (req, res) => {
  res.render('layout', {
    title: 'New Event',
    view: 'calendar/form',
    event: null,
    categories: CATEGORIES
  });
});

// Create event
router.post('/', requireRole('admin', 'pastor'), (req, res) => {
  const { title, description, event_date, start_time, end_time, location, category } = req.body;

  if (!title || !event_date) {
    req.session.flash = { type: 'error', message: 'Title and date are required.' };
    return res.redirect('/calendar/new');
  }

  calendarService.create({
    title, description, event_date, start_time, end_time, location, category,
    created_by: req.session.user.id
  });

  req.session.flash = { type: 'success', message: 'Event created!' };
  res.redirect('/calendar');
});

// Event detail
router.get('/event/:id', (req, res) => {
  const event = calendarService.getById(req.params.id);
  if (!event) {
    req.session.flash = { type: 'error', message: 'Event not found.' };
    return res.redirect('/calendar');
  }
  res.render('layout', {
    title: event.title,
    view: 'calendar/event',
    event
  });
});

// Edit event form
router.get('/event/:id/edit', requireRole('admin', 'pastor'), (req, res) => {
  const event = calendarService.getById(req.params.id);
  if (!event) {
    req.session.flash = { type: 'error', message: 'Event not found.' };
    return res.redirect('/calendar');
  }
  res.render('layout', {
    title: 'Edit Event',
    view: 'calendar/form',
    event,
    categories: CATEGORIES
  });
});

// Update event
router.post('/event/:id', requireRole('admin', 'pastor'), (req, res) => {
  const { title, description, event_date, start_time, end_time, location, category } = req.body;

  if (!title || !event_date) {
    req.session.flash = { type: 'error', message: 'Title and date are required.' };
    return res.redirect(`/calendar/event/${req.params.id}/edit`);
  }

  calendarService.update(req.params.id, { title, description, event_date, start_time, end_time, location, category });
  req.session.flash = { type: 'success', message: 'Event updated!' };
  res.redirect(`/calendar/event/${req.params.id}`);
});

// Delete event
router.post('/event/:id/delete', requireRole('admin', 'pastor'), (req, res) => {
  calendarService.delete(req.params.id);
  req.session.flash = { type: 'success', message: 'Event deleted.' };
  res.redirect('/calendar');
});

module.exports = router;
