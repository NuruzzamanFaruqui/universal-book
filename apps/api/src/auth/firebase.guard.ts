import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
      }

      const decoded = await admin.auth().verifyIdToken(token);
      
      // Find or create user in database
      const { PrismaClient } = require('@prisma/client');
      const { PrismaPg } = require('@prisma/adapter-pg');
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
      const prisma = new PrismaClient({ adapter });

      let user = await prisma.user.findUnique({
        where: { firebaseUid: decoded.uid }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: decoded.email || '',
            name: decoded.name || '',
            firebaseUid: decoded.uid,
            avatarUrl: decoded.picture || '',
          }
        });
      }

      await prisma.$disconnect();
      request.user = user;
      return true;
    } catch (error) {
      console.error('Auth error:', error.message);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
