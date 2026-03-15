const express = require('express');
const router = express.Router();
const calendarService = require('../services/calendarService');

router.get('/', (req, res) => {
  const upcomingEvents = calendarService.getUpcoming(5);
  res.render('layout', {
    title: 'Home',
    view: 'home',
    upcomingEvents
  });
});

module.exports = router;
