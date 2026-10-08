/*
 * Local dev helper: set a new login password for an existing user.
 *   node scripts/reset-password.js
 * Lists the accounts, asks for the email and the new password (typed hidden),
 * and stores it bcrypt-hashed, same as the User entity does.
 */
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

function ask(question, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : '');
  return new Promise((resolve) => rl.question(question, (answer) => {
    if (hidden) process.stdout.write('\n');
    rl.close();
    resolve(answer);
  }));
}

(async () => {
  const db = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await db.connect();
  const { rows } = await db.query('select email, role, status from users order by role, email');
  console.table(rows);

  const email = (await ask('Email: ')).toLowerCase().trim();
  const password = await ask('New password: ', true);
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');

  const hash = await bcrypt.hash(password, 10);
  const res = await db.query(
    `update users set password_hash = $1, status = 'ACTIVE' where email = $2`,
    [hash, email],
  );
  console.log(res.rowCount ? `Password updated for ${email}.` : `No user with email ${email}.`);
  await db.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
