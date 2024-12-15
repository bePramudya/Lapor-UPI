exports.login = (req, res) => {
  res.status(200).render('login', {
    title: 'Login',
  });
};

exports.laporan = (req, res) => {
  res.status(200).render('laporan', {
    title: 'Laporan',
  });
};
