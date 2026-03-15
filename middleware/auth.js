function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'error', message: 'Please log in to access that page.' };
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.session.flash = { type: 'error', message: 'Please log in to access that page.' };
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role)) {
      req.session.flash = { type: 'error', message: 'You do not have permission to do that.' };
      return res.redirect('back');
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
