import { Server, Socket } from 'socket.io';
import { queueCache } from '../services/cache.service';

export function setupQueueSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join a branch-specific room (e.g. for TV displays, reception dashboard, doctor console)
    socket.on('join:branch', (branchId: string) => {
      socket.join(`branch:${branchId}`);
      console.log(`Socket ${socket.id} joined branch room: branch:${branchId}`);
    });

    // Join a specific token room (e.g. for individual patient trackers)
    socket.on('join:token', (tokenId: string) => {
      socket.join(`token:${tokenId}`);
      console.log(`Socket ${socket.id} joined token room: token:${tokenId}`);
    });

    // Handle leave commands
    socket.on('leave:branch', (branchId: string) => {
      socket.leave(`branch:${branchId}`);
      console.log(`Socket ${socket.id} left branch room: branch:${branchId}`);
    });

    socket.on('leave:token', (tokenId: string) => {
      socket.leave(`token:${tokenId}`);
      console.log(`Socket ${socket.id} left token room: token:${tokenId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

/**
   * Helper to broadcast queue updates to a branch room
   */
export function broadcastQueueUpdate(io: Server, branchId: string, doctorId: string, queueData: any) {
  io.to(`branch:${branchId}`).emit('queue:updated', {
    doctorId,
    queue: queueData,
  });
}

/**
   * Helper to broadcast individual token status updates
   */
export function broadcastTokenUpdate(io: Server, tokenId: string, tokenData: any) {
  io.to(`token:${tokenId}`).emit('token:updated', tokenData);
}

/**
   * Helper to chime/notify TV display screen of a called token
   */
export function broadcastTokenCalled(io: Server, branchId: string, tokenNo: string, doctorName: string) {
  io.to(`branch:${branchId}`).emit('token:called', {
    tokenNo,
    doctorName,
  });
}

/**
   * Helper to broadcast doctor break status to TV displays and reception
   */
export function broadcastDoctorBreak(io: Server, branchId: string, doctorId: string, doctorName: string, onBreak: boolean, resumeAt: string | null) {
  io.to(`branch:${branchId}`).emit('doctor:break', {
    doctorId,
    doctorName,
    onBreak,
    resumeAt,
  });
}
