import { Module } from '@nestjs/common';
import { AuthorGroupsService } from './author-groups.service';
import { AuthorGroupsController } from './author-groups.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AuthorGroupsController],
  providers: [AuthorGroupsService, PrismaService],
  exports: [AuthorGroupsService],
})
export class AuthorGroupsModule {}
