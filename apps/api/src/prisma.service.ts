import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    this.client = new PrismaClient({ adapter } as any);
  }

  get user() { return this.client.user; }
  get book() { return this.client.book; }
  get chapter() { return this.client.chapter; }
  get subscription() { return this.client.subscription; }
  get setting() { return this.client.setting; }
  get publishedBook() { return this.client.publishedBook; }
  get bookPurchase() { return this.client.bookPurchase; }
  get bookReview() { return this.client.bookReview; }
  get bookFollow() { return this.client.bookFollow; }
  get writerFollow() { return this.client.writerFollow; }
  get activityFeed() { return this.client.activityFeed; }
  get writerEarning() { return this.client.writerEarning; }
  get userGroup() { return this.client.userGroup; }
  get groupMember() { return this.client.groupMember; }
  get groupMessage() { return this.client.groupMessage; }
  get authorGroup() { return this.client.authorGroup; }
  get authorGroupMember() { return this.client.authorGroupMember; }
  get post() { return this.client.post; }
  get postLike() { return this.client.postLike; }
  get postComment() { return this.client.postComment; }
  get postRepost() { return this.client.postRepost; }
  get notification() { return this.client.notification; }
  get conversation() { return this.client.conversation; }
  get directMessage() { return this.client.directMessage; }
  get connection() { return this.client.connection; }

  async onModuleInit() {
    try {
      await this.client.$connect();
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
    }
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
