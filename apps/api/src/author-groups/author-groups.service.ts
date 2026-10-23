import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthorGroupsService {
  constructor(private prisma: PrismaService) {}

  async createAuthorGroup(userId: string, data: { name: string; description?: string; bookId?: string }) {
    const group = await this.prisma.authorGroup.create({
      data: {
        name: data.name,
        description: data.description,
        bookId: data.bookId,
        createdBy: userId,
      },
    });
    await this.prisma.authorGroupMember.create({
      data: { userId, groupId: group.id, role: 'owner' },
    });
    await this.prisma.activityFeed.create({
      data: { userId, type: 'AUTHOR_GROUP_CREATED', message: `created author group "${group.name}"` },
    });
    return group;
  }

  async getAuthorGroupById(groupId: string) {
    return this.prisma.authorGroup.findUnique({
      where: { id: groupId },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } },
          },
        },
        book: {
          select: { id: true, title: true, genre: true, status: true },
        },
      },
    });
  }

  async getUserAuthorGroups(userId: string) {
    return this.prisma.authorGroupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            creator: { select: { id: true, name: true } },
            members: { select: { userId: true } },
            book: { select: { id: true, title: true } },
          },
        },
      },
    });
  }

  async inviteMember(groupId: string, ownerId: string, inviteeId: string, role: string = 'writer') {
    const group = await this.prisma.authorGroup.findFirst({
      where: { id: groupId, createdBy: ownerId },
    });
    if (!group) throw new ForbiddenException('Only the group owner can invite members');
    if (!(await this.areConnected(ownerId, inviteeId))) {
      throw new BadRequestException('You can only invite your connections');
    }
    const existing = await this.prisma.authorGroupMember.findUnique({
      where: { userId_groupId: { userId: inviteeId, groupId } },
    });
    if (existing) throw new BadRequestException('User is already a member');
    return this.prisma.authorGroupMember.create({
      data: { userId: inviteeId, groupId, role },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } },
      },
    });
  }

  async removeMember(groupId: string, ownerId: string, memberId: string) {
    const group = await this.prisma.authorGroup.findFirst({
      where: { id: groupId, createdBy: ownerId },
    });
    if (!group) throw new Error('Only the group owner can remove members');
    return this.prisma.authorGroupMember.delete({
      where: { userId_groupId: { userId: memberId, groupId } },
    });
  }

  async linkBook(groupId: string, ownerId: string, bookId: string) {
    const group = await this.prisma.authorGroup.findFirst({
      where: { id: groupId, createdBy: ownerId },
    });
    if (!group) throw new Error('Only the group owner can link a book');
    return this.prisma.authorGroup.update({
      where: { id: groupId },
      data: { bookId },
    });
  }

  /**
   * The user's accepted connections, for the co-writer invite picker.
   *
   * Co-writing gives edit access to a manuscript, so it is gated on a
   * connection (both people agreed) rather than a follow (one-sided).
   */
  async listConnections(userId: string) {
    const select = { id: true, name: true, avatarUrl: true, profilePhoto: true };
    const rows = await this.prisma.connection.findMany({
      where: { status: 'ACCEPTED', OR: [{ senderId: userId }, { receiverId: userId }] },
      include: { sender: { select }, receiver: { select } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(r => (r.senderId === userId ? r.receiver : r.sender));
  }

  /** True when the two users have an accepted connection, in either direction. */
  private async areConnected(a: string, b: string) {
    const row = await this.prisma.connection.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: a, receiverId: b },
          { senderId: b, receiverId: a },
        ],
      },
      select: { id: true },
    });
    return !!row;
  }

  /** Everyone (except the owner) who can co-edit this book. Owner only. */
  async getBookCollaborators(bookId: string, userId: string) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { userId: true } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.userId !== userId) throw new ForbiddenException('Only the book owner can see collaborators');
    const members = await this.prisma.authorGroupMember.findMany({
      where: { group: { bookId }, userId: { not: userId } },
      include: { user: { select: { id: true, name: true, avatarUrl: true, profilePhoto: true } } },
    });
    return members.map(m => m.user);
  }

  /** Invite a connection to co-write a book. Creates the book's group on first use. */
  async inviteToBook(bookId: string, ownerId: string, inviteeId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, userId: true, title: true },
    });
    if (!book) throw new NotFoundException('Book not found');
    if (book.userId !== ownerId) throw new ForbiddenException('Only the book owner can invite collaborators');
    if (inviteeId === ownerId) throw new BadRequestException('You cannot invite yourself');

    if (!(await this.areConnected(ownerId, inviteeId))) {
      throw new BadRequestException('You can only invite your connections');
    }

    let group = await this.prisma.authorGroup.findFirst({ where: { bookId, createdBy: ownerId } });
    if (!group) {
      group = await this.prisma.authorGroup.create({
        data: {
          name: `${book.title || 'Untitled book'} — co-writers`,
          bookId,
          createdBy: ownerId,
        },
      });
      await this.prisma.authorGroupMember.create({
        data: { userId: ownerId, groupId: group.id, role: 'owner' },
      });
    }

    const existing = await this.prisma.authorGroupMember.findUnique({
      where: { userId_groupId: { userId: inviteeId, groupId: group.id } },
    });
    if (existing) return { alreadyMember: true };

    await this.prisma.authorGroupMember.create({
      data: { userId: inviteeId, groupId: group.id, role: 'writer' },
    });

    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { name: true } });
    await this.prisma.notification.create({
      data: {
        userId: inviteeId,
        type: 'BOOK_COLLAB_INVITE',
        message: `${owner?.name || 'Someone'} invited you to co-write "${book.title || 'Untitled book'}"`,
        linkId: bookId,
      },
    });
    return { invited: true };
  }

  async deleteAuthorGroup(groupId: string, ownerId: string) {
    const group = await this.prisma.authorGroup.findFirst({
      where: { id: groupId, createdBy: ownerId },
    });
    if (!group) throw new Error('Only the group owner can delete this group');
    return this.prisma.authorGroup.delete({ where: { id: groupId } });
  }
}
