import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'https://universal-book.com',
      'https://www.universal-book.com',
      'https://universal-book-web-73444175926.us-central1.run.app',
      'https://universal-book-web-lkb47uauda-uc.a.run.app',
    ],
    credentials: true,
  },
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeUsers: Map<string, { userId: string; name: string; bookId: string }> = new Map();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const user = this.activeUsers.get(client.id);
    if (user) {
      this.server.to(user.bookId).emit('user-left', { userId: user.userId, name: user.name });
      this.activeUsers.delete(client.id);
      this.broadcastActiveUsers(user.bookId);
    }
  }

  @SubscribeMessage('join-book')
  handleJoinBook(@ConnectedSocket() client: Socket, @MessageBody() data: { bookId: string; userId: string; name: string }) {
    client.join(data.bookId);
    this.activeUsers.set(client.id, { userId: data.userId, name: data.name, bookId: data.bookId });
    client.to(data.bookId).emit('user-joined', { userId: data.userId, name: data.name });
    this.broadcastActiveUsers(data.bookId);
  }

  @SubscribeMessage('leave-book')
  handleLeaveBook(@ConnectedSocket() client: Socket, @MessageBody() data: { bookId: string }) {
    client.leave(data.bookId);
    const user = this.activeUsers.get(client.id);
    if (user) {
      this.server.to(data.bookId).emit('user-left', { userId: user.userId, name: user.name });
      this.activeUsers.delete(client.id);
      this.broadcastActiveUsers(data.bookId);
    }
  }

  @SubscribeMessage('chapter-update')
  handleChapterUpdate(@ConnectedSocket() client: Socket, @MessageBody() data: { bookId: string; chapterId: string; content: string; userId: string }) {
    client.to(data.bookId).emit('chapter-updated', { chapterId: data.chapterId, content: data.content, userId: data.userId });
  }

  @SubscribeMessage('cursor-move')
  handleCursorMove(@ConnectedSocket() client: Socket, @MessageBody() data: { bookId: string; userId: string; name: string; position: number; chapterId: string }) {
    client.to(data.bookId).emit('cursor-moved', data);
  }

  @SubscribeMessage('chat-message')
  handleChatMessage(@ConnectedSocket() client: Socket, @MessageBody() data: { bookId: string; userId: string; name: string; message: string }) {
    this.server.to(data.bookId).emit('new-chat-message', { ...data, timestamp: new Date().toISOString() });
  }

  private broadcastActiveUsers(bookId: string) {
    const users = Array.from(this.activeUsers.values()).filter(u => u.bookId === bookId);
    this.server.to(bookId).emit('active-users', users);
  }
}
