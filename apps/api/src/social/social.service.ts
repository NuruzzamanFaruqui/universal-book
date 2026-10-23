import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  private async nameOf(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return u?.name || 'Someone';
  }

  async createPost(userId: string, content: string, bookId?: string, hashtags?: string[]) {
    const post = await this.prisma.post.create({
      data: { userId, content, bookId: bookId || null, hashtags: hashtags || [] },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true, isVerified: true } },
        book: { select: { id: true, title: true, genre: true } },
        likes: { select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
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
          reposts: { select: { userId: true } },
          comments: {
            include: { user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
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
          reposts: { select: { userId: true } },
          comments: {
            include: { user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
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
        reposts: { select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
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
        data: {
          userId: post.userId,
          type: 'POST_LIKE',
          message: `${await this.nameOf(userId)} liked your post`,
          linkId: postId,
        },
      });
    }
    return { liked: true };
  }

  async commentOnPost(userId: string, postId: string, content: string) {
    const comment = await this.prisma.postComment.create({
      data: { userId, postId, content },
      include: { user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
    });
    await this.prisma.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (post && post.userId !== userId) {
      await this.prisma.notification.create({
        data: { userId: post.userId, type: 'POST_COMMENT', message: `${await this.nameOf(userId)} commented on your post`, linkId: postId },
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
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (post && post.userId !== userId) {
      await this.prisma.notification.create({
        data: {
          userId: post.userId,
          type: 'POST_REPOST',
          message: `${await this.nameOf(userId)} reposted your post`,
          linkId: postId,
        },
      });
    }
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
    // await this.prisma.notification.updateMany({
    //   where: { userId, isRead: false },
    //   data: { isRead: true },
    // });
    return notifs;
  }

  async getUnreadNotificationCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markNotificationsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // Connection Methods
  //
  // One row per pair, in either direction. status is PENDING, ACCEPTED or
  // DECLINED. A DECLINED row is kept only so the decline is not reported to the
  // sender; it reads as "not connected" and a fresh request replaces it.
  async sendConnectionRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) throw new BadRequestException('You cannot connect with yourself');

    const target = await this.prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing?.status === 'ACCEPTED') throw new BadRequestException('You are already connected');
    if (existing?.status === 'PENDING') {
      if (existing.senderId === senderId) throw new BadRequestException('Connection request already sent');
      // They asked first. Sending one back is a yes.
      return this.respondToConnection(senderId, existing.id, 'ACCEPTED');
    }
    if (existing) await this.prisma.connection.delete({ where: { id: existing.id } });

    const connection = await this.prisma.connection.create({
      data: { senderId, receiverId, status: 'PENDING' },
    });
    await this.prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'CONNECTION_REQUEST',
        message: `${await this.nameOf(senderId)} sent you a connection request`,
        linkId: senderId,
      },
    });

    await this.notifyByEmail('connection request', async () => {
      const { [senderId]: sender, [receiverId]: receiver } = await this.contacts(senderId, receiverId);
      if (!receiver) return;
      await this.email.sendConnectionRequest({
        to: receiver.email,
        recipientName: receiver.name,
        senderName: sender?.name ?? null,
      });
    });
    return connection;
  }

  async respondToConnection(userId: string, connectionId: string, status: 'ACCEPTED' | 'DECLINED') {
    if (status !== 'ACCEPTED' && status !== 'DECLINED') {
      throw new BadRequestException('status must be ACCEPTED or DECLINED');
    }
    const connection = await this.prisma.connection.findFirst({
      where: { id: connectionId, receiverId: userId },
    });
    if (!connection) throw new NotFoundException('Connection request not found');
    // Declining something already accepted would silently disconnect; that is
    // what DELETE /connections/:id is for.
    if (connection.status === 'ACCEPTED' && status === 'DECLINED') {
      throw new BadRequestException('Already connected — remove the connection instead');
    }
    const updated = await this.prisma.connection.update({
      where: { id: connectionId },
      data: { status },
    });
    // Only a pending request can be newly accepted; responding again to one
    // already accepted must not notify the sender a second time.
    if (status === 'ACCEPTED' && connection.status === 'PENDING') {
      await this.prisma.notification.create({
        data: {
          userId: connection.senderId,
          type: 'CONNECTION_ACCEPTED',
          message: `${await this.nameOf(userId)} accepted your connection request`,
          linkId: userId,
        },
      });

      await this.notifyByEmail('connection accepted', async () => {
        const { [connection.senderId]: sender, [userId]: accepter } = await this.contacts(connection.senderId, userId);
        if (!sender) return;
        await this.email.sendConnectionAccepted({
          to: sender.email,
          recipientName: sender.name,
          accepterName: accepter?.name ?? null,
          accepterId: userId,
        });
      });
    }
    return updated;
  }

  /**
   * Runs after the change is saved. Awaited rather than fire-and-forget because
   * Cloud Run throttles CPU once the response is sent; caught so that a failed
   * lookup or send can never turn a saved action into an error response.
   */
  private async notifyByEmail(what: string, send: () => Promise<void>) {
    try {
      await send();
    } catch (err: any) {
      this.logger.error(`Could not email ${what}: ${err?.message ?? err}`);
    }
  }

  /** Name and address for each user, keyed by id, for notification emails. */
  private async contacts(...ids: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    return Object.fromEntries(users.map((u) => [u.id, u])) as Record<
      string,
      { id: string; name: string | null; email: string } | undefined
    >;
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

  /**
   * The relationship between the caller and `targetId`, from the caller's side:
   *
   *   NONE      no request, or one that was declined
   *   PENDING   the caller sent a request that is waiting
   *   INCOMING  the target sent the caller a request that is waiting
   *   CONNECTED accepted
   *
   * A declined request reads as NONE to both sides, so the sender is never told
   * they were turned down and can ask again later.
   */
  async getConnectionStatus(userId: string, targetId: string) {
    const connection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetId },
          { senderId: targetId, receiverId: userId },
        ],
      },
    });

    let state: 'NONE' | 'PENDING' | 'INCOMING' | 'CONNECTED' = 'NONE';
    if (connection?.status === 'ACCEPTED') state = 'CONNECTED';
    else if (connection?.status === 'PENDING') state = connection.senderId === userId ? 'PENDING' : 'INCOMING';

    return {
      state,
      connectionId: state === 'NONE' ? null : connection!.id,
      // The raw row, kept for any caller that read it before `state` existed.
      ...(connection ?? {}),
    };
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

  /**
   * Throws unless `userId` is one of the two participants. Every conversation
   * read or write goes through this — without it, any authenticated user could
   * read or post into a private thread by id alone.
   */
  private async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, user1Id: true, user2Id: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
    return conversation;
  }

  async sendDirectMessage(conversationId: string, senderId: string, content: string) {
    await this.assertParticipant(conversationId, senderId);

    const message = await this.prisma.directMessage.create({
      data: { conversationId, senderId, content },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    // Replaces the RTDB fan-out: the recipient's poll picks this up, and the
    // notification drives the unread badge when they aren't on the thread.
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true },
    });
    const recipientId =
      conversation!.user1Id === senderId ? conversation!.user2Id : conversation!.user1Id;

    // One unread notification per conversation, not per message — a fifty
    // message exchange should light the bell once, not fifty times.
    const alreadyPending = await this.prisma.notification.findFirst({
      where: {
        userId: recipientId,
        type: 'DIRECT_MESSAGE',
        linkId: conversationId,
        isRead: false,
      },
      select: { id: true },
    });
    if (!alreadyPending) {
      await this.prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'DIRECT_MESSAGE',
          message: `${await this.nameOf(senderId)} sent you a message`,
          linkId: conversationId,
        },
      });
    }

    return message;
  }

  /**
   * `since` makes this pollable: pass the timestamp of the newest message you
   * already hold and only newer ones come back.
   */
  async getConversationMessages(conversationId: string, userId: string, since?: string) {
    await this.assertParticipant(conversationId, userId);

    const sinceDate = since ? new Date(since) : null;
    const validSince = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : null;

    const messages = await this.prisma.directMessage.findMany({
      where: {
        conversationId,
        ...(validSince ? { createdAt: { gt: validSince } } : {}),
      },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
      orderBy: { createdAt: 'asc' },
      // Unbounded on a first load, but a poll only ever returns the delta.
      take: validSince ? 200 : 500,
    });

    // Mark the other side's messages read now that they've been delivered.
    if (messages.length) {
      await this.prisma.directMessage.updateMany({
        where: { conversationId, senderId: { not: userId }, isRead: false },
        data: { isRead: true },
      });
    }

    return messages;
  }

  async getSuggestedUsers(userId: string) {
    const connections = await this.prisma.connection.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    });
    const connectedIds = connections.map(c => c.senderId === userId ? c.receiverId : c.senderId);
    connectedIds.push(userId);

    const followed = await this.prisma.writerFollow.findMany({
      where: { followerId: userId },
      select: { writerId: true },
    });
    followed.forEach(f => connectedIds.push(f.writerId));

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
