import { Test, TestingModule } from '@nestjs/testing';
import { AuthorGroupsController } from './author-groups.controller';

describe('AuthorGroupsController', () => {
  let controller: AuthorGroupsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthorGroupsController],
    }).compile();

    controller = module.get<AuthorGroupsController>(AuthorGroupsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
