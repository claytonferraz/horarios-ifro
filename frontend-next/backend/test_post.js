const request = require('http').request;

const payload = JSON.stringify({
  action: 'lancamento_extra',
  siape: "2091039",
  week_id: "8",
  description: "Teste",
  original_slot: { day: "Segunda-feira", time: "16:40 - 17:30", subject: "B.D.II", className: "3ºA INF" },
  proposed_day: "Segunda-feira",
  proposed_time: "16:40 - 17:30",
  proposed_type: "Recuperação",
  proposed_slot: {
     classType: "Recuperação",
     subject: "B.D.II",
     className: "3ºA INF",
     day: "Segunda-feira",
     time: "16:40 - 17:30",
     slots: [{ id: "test", time: "16:40 - 17:30" }],
     type: "atual"
  }
});

const req = request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/requests',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'x-user-role': 'professor',
    'x-user-id': '2091039'
  }
}, (res) => {
  res.on('data', (d) => process.stdout.write(d));
});

req.write(payload);
req.end();
