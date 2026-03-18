import { Injectable } from '@nestjs/common';
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
        creator: { select: { id: true, name: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
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
    if (!group) throw new Error('Only the group owner can invite members');
    const existing = await this.prisma.authorGroupMember.findUnique({
      where: { userId_groupId: { userId: inviteeId, groupId } },
    });
    if (existing) throw new Error('User is already a member');
    return this.prisma.authorGroupMember.create({
      data: { userId: inviteeId, groupId, role },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
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

  async deleteAuthorGroup(groupId: string, ownerId: string) {
    const group = await this.prisma.authorGroup.findFirst({
      where: { id: groupId, createdBy: ownerId },
    });
    if (!group) throw new Error('Only the group owner can delete this group');
    return this.prisma.authorGroup.delete({ where: { id: groupId } });
  }
}
