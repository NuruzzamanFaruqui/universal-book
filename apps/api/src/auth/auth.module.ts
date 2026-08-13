import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './jwt-auth.guard';
import { UsersModule } from '../users/users.module';

/**
 * Global because JwtAuthGuard is referenced by controllers across every feature
 * module, and Nest resolves a guard's dependencies from the module that
 * declares the controller using it.
 */
@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
      signOptions: { issuer: 'universal-book' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
