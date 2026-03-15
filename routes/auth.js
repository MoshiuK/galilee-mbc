const express = require('express');
const router = express.Router();
const authService = require('../services/authService');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('layout', { title: 'Login', view: 'auth/login' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    req.session.flash = { type: 'error', message: 'Username and password are required.' };
    return res.redirect('/login');
  }

  const user = authService.login(username, password);
  if (!user) {
    req.session.flash = { type: 'error', message: 'Invalid username or password.' };
    return res.redirect('/login');
  }

  req.session.user = user;
  req.session.flash = { type: 'success', message: `Welcome back, ${user.full_name}!` };
  res.redirect('/');
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('layout', { title: 'Register', view: 'auth/register' });
});

router.post('/register', (req, res) => {
  const { username, password, confirm_password, full_name } = req.body;

  if (!username || !password || !full_name) {
    req.session.flash = { type: 'error', message: 'All fields are required.' };
    return res.redirect('/register');
  }

  if (password !== confirm_password) {
    req.session.flash = { type: 'error', message: 'Passwords do not match.' };
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.session.flash = { type: 'error', message: 'Password must be at least 6 characters.' };
    return res.redirect('/register');
  }

  const existing = authService.findByUsername(username);
  if (existing) {
    req.session.flash = { type: 'error', message: 'That username is already taken.' };
    return res.redirect('/register');
  }

  const user = authService.register(username, password, full_name);
  req.session.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
  req.session.flash = { type: 'success', message: 'Account created! Welcome to Galilee MBC.' };
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
