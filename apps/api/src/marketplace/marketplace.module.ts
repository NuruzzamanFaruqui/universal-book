import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MarketplaceController],
  providers: [MarketplaceService, PrismaService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
