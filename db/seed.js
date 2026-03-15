const db = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  await db.init();

  // Check if already seeded
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    console.log('Database already seeded. Skipping.');
    process.exit(0);
  }

  console.log('Seeding database...');

  // Create pastor account (password: galilee2026)
  const pastorHash = bcrypt.hashSync('galilee2026', 10);
  const pastor = db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
  ).run('pastor.knox', pastorHash, 'Pastor Moshiu T. Knox', 'pastor');

  // Create a member account (password: member2026)
  const memberHash = bcrypt.hashSync('member2026', 10);
  const member = db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
  ).run('member1', memberHash, 'Sister Grace Johnson', 'member');

  // Seed calendar events from bulletin content
  const events = [
    { title: 'Sunday Worship Service', description: 'Sermon: "Faith When Life Gets Hard" — James 1:2–4', event_date: '2026-03-15', start_time: '11:00', end_time: '13:00', category: 'worship' },
    { title: 'Wednesday Bible Study', description: 'Weekly Bible study and fellowship.', event_date: '2026-03-18', start_time: '19:00', end_time: '20:30', category: 'bible-study' },
    { title: 'Youth Night', description: 'Friday evening youth fellowship and activities.', event_date: '2026-03-20', start_time: '18:30', end_time: '20:00', category: 'youth' },
    { title: 'Sunday Worship Service', description: 'Join us for worship, praise, and the Word.', event_date: '2026-03-22', start_time: '11:00', end_time: '13:00', category: 'worship' },
    { title: 'Wednesday Bible Study', description: 'Weekly Bible study and fellowship.', event_date: '2026-03-25', start_time: '19:00', end_time: '20:30', category: 'bible-study' },
    { title: 'Youth Night', description: 'Friday evening youth fellowship.', event_date: '2026-03-27', start_time: '18:30', end_time: '20:00', category: 'youth' },
    { title: 'Sunday Worship Service', description: 'Join us for worship.', event_date: '2026-03-29', start_time: '11:00', end_time: '13:00', category: 'worship' },
    { title: 'Church Business Meeting', description: 'Monthly church business meeting. All members welcome.', event_date: '2026-03-28', start_time: '10:00', end_time: '11:30', category: 'meeting' },
    { title: 'Easter Planning Fellowship', description: 'Planning meeting and fellowship dinner for Easter celebration.', event_date: '2026-04-04', start_time: '12:00', end_time: '14:00', category: 'fellowship' },
  ];

  const insertEvent = db.prepare(
    'INSERT INTO calendar_events (title, description, event_date, start_time, end_time, location, category, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  events.forEach(e => {
    insertEvent.run(e.title, e.description, e.event_date, e.start_time, e.end_time, 'Galilee MBC', e.category, pastor.lastInsertRowid);
  });

  // Seed a welcome message
  db.prepare(
    'INSERT INTO messages (sender_id, recipient_id, subject, body) VALUES (?, ?, ?, ?)'
  ).run(pastor.lastInsertRowid, member.lastInsertRowid,
    'Welcome to Galilee MBC!',
    'Welcome to our church family! We are so glad you have joined us. Feel free to reach out if you need anything at all. God bless you!'
  );

  console.log('Seeded: 2 users, ' + events.length + ' events, 1 message');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
