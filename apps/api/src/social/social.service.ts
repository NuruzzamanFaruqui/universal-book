import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SocialService {
  constructor(private prisma: PrismaService) {}

  async createPost(userId: string, content: string, bookId?: string, hashtags?: string[]) {
    const post = await this.prisma.post.create({
      data: { userId, content, bookId: bookId || null, hashtags: hashtags || [] },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true, isVerified: true } },
        book: { select: { id: true, title: true, genre: true } },
        likes: { select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
          take: 3,
        },
      },
    });
    return post;
  }

  async getFeed(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [{ senderId: userId, status: 'ACCEPTED' }, { receiverId: userId, status: 'ACCEPTED' }],
      },
    });
    const connectedIds = connections.map(c => c.senderId === userId ? c.receiverId : c.senderId);
    const following = await this.prisma.writerFollow.findMany({ where: { followerId: userId }, select: { writerId: true } });
    const followingIds = following.map(f => f.writerId);
    const feedIds = [...new Set([...connectedIds, ...followingIds, userId])];

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { userId: { in: feedIds } },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true, isVerified: true } },
          book: { include: { published: { select: { price: true, isPublic: true } }, chapters: { select: { id: true } } } },
          likes: { select: { userId: true } },
          comments: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
            take: 3,
          },
          _count: { select: { comments: true, likes: true, reposts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where: { userId: { in: feedIds } } }),
    ]);
    return { posts, total, page, limit };
  }

  async getExploreFeed(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true, isVerified: true } },
          book: { include: { published: { select: { price: true, isPublic: true } }, chapters: { select: { id: true } } } },
          likes: { select: { userId: true } },
          comments: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
            take: 3,
          },
          _count: { select: { comments: true, likes: true, reposts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count(),
    ]);
    return { posts, total, page, limit };
  }

  async getUserPosts(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return this.prisma.post.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true, isVerified: true } },
        book: { include: { published: { select: { price: true, isPublic: true } } } },
        likes: { select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
          take: 3,
        },
        _count: { select: { comments: true, likes: true, reposts: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async likePost(userId: string, postId: string) {
    const existing = await this.prisma.postLike.findUnique({ where: { userId_postId: { userId, postId } } });
    if (existing) {
      await this.prisma.postLike.delete({ where: { userId_postId: { userId, postId } } });
      await this.prisma.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } });
      return { liked: false };
    }
    await this.prisma.postLike.create({ data: { userId, postId } });
    await this.prisma.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } });
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (post && post.userId !== userId) {
      await this.prisma.notification.create({
        data: { userId: post.userId, type: 'POST_LIKE', message: 'liked your post', linkId: postId },
      });
    }
    return { liked: true };
  }

  async commentOnPost(userId: string, postId: string, content: string) {
    const comment = await this.prisma.postComment.create({
      data: { userId, postId, content },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    await this.prisma.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (post && post.userId !== userId) {
      await this.prisma.notification.create({
        data: { userId: post.userId, type: 'POST_COMMENT', message: 'commented on your post', linkId: postId },
      });
    }
    return comment;
  }

  async repostPost(userId: string, postId: string) {
    const existing = await this.prisma.postRepost.findUnique({ where: { userId_postId: { userId, postId } } });
    if (existing) {
      await this.prisma.postRepost.delete({ where: { userId_postId: { userId, postId } } });
      await this.prisma.post.update({ where: { id: postId }, data: { repostsCount: { decrement: 1 } } });
      return { reposted: false };
    }
    await this.prisma.postRepost.create({ data: { userId, postId } });
    await this.prisma.post.update({ where: { id: postId }, data: { repostsCount: { increment: 1 } } });
    return { reposted: true };
  }

  async deletePost(userId: string, postId: string) {
    return this.prisma.post.delete({ where: { id: postId, userId } });
  }

  async getNotifications(userId: string) {
    const notifs = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return notifs;
  }

  async getUnreadNotificationCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markNotificationsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // Connection Methods
  async sendConnectionRequest(senderId: string, receiverId: string) {
    const existing = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });
    if (existing) throw new Error('Connection already exists');
    const connection = await this.prisma.connection.create({
      data: { senderId, receiverId, status: 'PENDING' },
    });
    await this.prisma.notification.create({
      data: { userId: receiverId, type: 'CONNECTION_REQUEST', message: 'sent you a connection request', linkId: senderId },
    });
    return connection;
  }

  async respondToConnection(userId: string, connectionId: string, status: 'ACCEPTED' | 'DECLINED') {
    const connection = await this.prisma.connection.findFirst({
      where: { id: connectionId, receiverId: userId },
    });
    if (!connection) throw new Error('Connection request not found');
    const updated = await this.prisma.connection.update({
      where: { id: connectionId },
      data: { status },
    });
    if (status === 'ACCEPTED') {
      await this.prisma.notification.create({
        data: { userId: connection.senderId, type: 'CONNECTION_ACCEPTED', message: 'accepted your connection request', linkId: userId },
      });
    }
    return updated;
  }

  async removeConnection(userId: string, connectionId: string) {
    return this.prisma.connection.deleteMany({
      where: {
        id: connectionId,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
    });
  }

  async getUserConnections(userId: string) {
    return this.prisma.connection.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: 'ACCEPTED',
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true, isVerified: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true, isVerified: true } },
      },
    });
  }

  async getPendingRequests(userId: string) {
    return this.prisma.connection.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true, bio: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnectionStatus(userId: string, targetId: string) {
    const connection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetId },
          { senderId: targetId, receiverId: userId },
        ],
      },
    });
    return connection;
  }

  async getOrCreateConversation(user1Id: string, user2Id: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id, user2Id },
          { user1Id: user2Id, user2Id: user1Id },
        ],
      },
      include: {
        user1: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } },
        user2: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { sender: { select: { id: true, name: true } } },
        },
      },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: { user1Id, user2Id },
      include: {
        user1: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } },
        user2: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } },
        messages: true,
      },
    });
  }

  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      include: {
        user1: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } },
        user2: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async sendDirectMessage(conversationId: string, senderId: string, content: string) {
    const message = await this.prisma.directMessage.create({
      data: { conversationId, senderId, content },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return message;
  }

  async getConversationMessages(conversationId: string) {
    return this.prisma.directMessage.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getSuggestedUsers(userId: string) {
    const connections = await this.prisma.connection.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    });
    const connectedIds = connections.map(c => c.senderId === userId ? c.receiverId : c.senderId);
    connectedIds.push(userId);

    return this.prisma.user.findMany({
      where: { id: { notIn: connectedIds } },
      select: {
        id: true, name: true, avatarUrl: true, profilePhoto: true, bio: true, isVerified: true, expertise: true,
        books: { where: { published: { isPublic: true } }, select: { id: true } },
        followers: true,
      },
      take: 5,
    });
  }

  async getTrendingHashtags() {
    const posts = await this.prisma.post.findMany({
      select: { hashtags: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const hashtagCount: Record<string, number> = {};
    posts.forEach(p => { p.hashtags.forEach(tag => { hashtagCount[tag] = (hashtagCount[tag] || 0) + 1; }); });
    return Object.entries(hashtagCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count }));
  }
}
