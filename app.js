const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db/database');
const messageService = require('./services/messageService');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'galilee-mbc-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Make user and flash available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;

  // Unread message count for nav badge
  if (req.session.user) {
    res.locals.unreadCount = messageService.getUnreadCount(req.session.user.id);
  } else {
    res.locals.unreadCount = 0;
  }

  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/', require('./routes/auth'));
app.use('/calendar', require('./routes/calendar'));
app.use('/messages', require('./routes/messages'));
app.use('/admin', require('./routes/admin'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('layout', {
    title: 'Not Found',
    body: '<div class="container"><h1>Page Not Found</h1><p>The page you are looking for does not exist.</p><a href="/">Return Home</a></div>'
  });
});

module.exports = app;
