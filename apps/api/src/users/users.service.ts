import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({
      where: { firebaseUid },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: {
    email: string;
    name?: string;
    firebaseUid: string;
    avatarUrl?: string;
  }) {
    return this.prisma.user.create({
      data,
    });
  }

  async updateUser(id: string, data: {
    name?: string;
    avatarUrl?: string;
  }) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async getUserWithBooks(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        books: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }
}