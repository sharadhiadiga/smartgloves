/** Socket.IO hub — broadcast vitals & alerts to connected dashboards */

let ioInstance = null;

function initSocketIO(httpServer) {
  const { Server } = require('socket.io');
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);
    socket.emit('server:hello', {
      message: 'Smart Gloves realtime channel ready',
      time: new Date().toISOString(),
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Client disconnected:', socket.id, reason);
    });
  });

  console.log('[Socket.IO] Initialized');
  return ioInstance;
}

function getIO() {
  return ioInstance;
}

function broadcastVitalsUpdate(payload) {
  if (!ioInstance) return;
  ioInstance.emit('vitals:update', payload);
  console.log('[Socket.IO] vitals:update', payload.patientId, payload.overallRiskLevel);
}

function broadcastAlert(alert) {
  if (!ioInstance) return;
  ioInstance.emit('alert:new', alert);
  console.log('[Socket.IO] alert:new', alert.patientId, alert.overallRiskLevel);
}

module.exports = {
  initSocketIO,
  getIO,
  broadcastVitalsUpdate,
  broadcastAlert,
};
