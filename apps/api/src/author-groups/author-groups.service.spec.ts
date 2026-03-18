import { Test, TestingModule } from '@nestjs/testing';
import { AuthorGroupsService } from './author-groups.service';

describe('AuthorGroupsService', () => {
  let service: AuthorGroupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthorGroupsService],
    }).compile();

    service = module.get<AuthorGroupsService>(AuthorGroupsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
