// Simple test backend - koi npm install nahi chahiye, sirf Node.js
// Run: node server.js
const http = require('http');
const crypto = require('crypto');

const users = {}; // memory me store hota hai (server restart = data gaya)

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  if (req.method !== 'POST') return send(res, 404, { message: 'Not found' });
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    let b = {};
    try { b = JSON.parse(data); } catch (_) {}
    console.log(req.method, req.url, b.email || '');

    if (req.url === '/api/auth/register') {
      if (!b.name || !b.email || !b.password)
        return send(res, 400, { message: 'All fields required' });
      if (users[b.email]) return send(res, 409, { message: 'Email already registered' });
      users[b.email] = { name: b.name, password: b.password };
      return send(res, 201, { message: 'Registration successful' });
    }

    if (req.url === '/api/auth/login') {
      const u = users[b.email];
      if (!u || u.password !== b.password)
        return send(res, 401, { message: 'Invalid email or password' });
      return send(res, 200, { token: crypto.randomBytes(16).toString('hex'), name: u.name });
    }
    send(res, 404, { message: 'Not found' });
  });
}).listen(5000, '0.0.0.0', () => console.log('Server running on http://localhost:5000'));
