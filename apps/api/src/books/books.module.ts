import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { AiModule } from '../ai/ai.module';
import { PaymentsModule } from '../payments/payments.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AiModule, PaymentsModule, StorageModule],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}