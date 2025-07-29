// generateAdminHash.js
const bcrypt = require('bcryptjs');
//josephine04kyalo@gmail.com
const plainPassword = 'Admin@123';
bcrypt.hash(plainPassword, 12).then(hash => {
  console.log('Hashed Password:', hash);
});
