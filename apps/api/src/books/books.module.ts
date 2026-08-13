import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { AiModule } from '../ai/ai.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [AiModule, PaymentsModule],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}