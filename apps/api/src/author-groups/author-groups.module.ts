import { Module } from '@nestjs/common';
import { AuthorGroupsService } from './author-groups.service';
import { AuthorGroupsController } from './author-groups.controller';

@Module({
  controllers: [AuthorGroupsController],
  providers: [AuthorGroupsService],
  exports: [AuthorGroupsService],
})
export class AuthorGroupsModule {}
