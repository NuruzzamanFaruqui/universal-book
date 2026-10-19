import { IsBoolean } from 'class-validator';

export class SetChapterProgressDto {
  @IsBoolean({ message: 'isRead must be true or false.' })
  isRead: boolean;
}
