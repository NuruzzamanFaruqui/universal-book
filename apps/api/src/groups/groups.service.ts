import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async getAllGroups() {
    return this.prisma.userGroup.findMany({
      where: { isPublic: true },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        members: { select: { userId: true, role: true } },
        _count: { select: { members: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGroupById(groupId: string) {
    return this.prisma.userGroup.findUnique({
      where: { id: groupId },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        messages: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { members: true, messages: true } },
      },
    });
  }

  async createGroup(userId: string, data: { name: string; description?: string; isPublic?: boolean }) {
    const group = await this.prisma.userGroup.create({
      data: {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? true,
        createdBy: userId,
      },
    });
    // Auto-join creator as admin
    await this.prisma.groupMember.create({
      data: { userId, groupId: group.id, role: 'admin' },
    });
    await this.prisma.activityFeed.create({
      data: { userId, type: 'GROUP_CREATED', message: `created group "${group.name}"` },
    });
    return group;
  }

  async joinGroup(userId: string, groupId: string) {
    const existing = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (existing) {
      await this.prisma.groupMember.delete({
        where: { userId_groupId: { userId, groupId } },
      });
      return { joined: false };
    }
    await this.prisma.groupMember.create({
      data: { userId, groupId, role: 'member' },
    });
    return { joined: true };
  }

  async sendMessage(userId: string, groupId: string, message: string) {
    return this.prisma.groupMessage.create({
      data: { userId, groupId, message },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async getMessages(groupId: string) {
    return this.prisma.groupMessage.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async getUserGroups(userId: string) {
    return this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true, messages: true } },
          },
        },
      },
    });
  }

  async deleteGroup(userId: string, groupId: string) {
    const group = await this.prisma.userGroup.findFirst({
      where: { id: groupId, createdBy: userId },
    });
    if (!group) throw new Error('Group not found or unauthorized');
    return this.prisma.userGroup.delete({ where: { id: groupId } });
  }
}
