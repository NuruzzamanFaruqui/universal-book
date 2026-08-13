import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { GroupsModule } from './groups/groups.module';
import { AuthorGroupsModule } from './author-groups/author-groups.module';
import { SocialModule } from './social/social.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EmailModule,
    AuthModule,
    BooksModule,
    UsersModule,
    AiModule,
    AdminModule,
    PaymentsModule,
    MarketplaceModule,
    GroupsModule,
    AuthorGroupsModule,
    SocialModule,
  ],
})
export class AppModule {}
