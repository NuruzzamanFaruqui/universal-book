import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';

async function verifyAndGetUser(request: any): Promise<any> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split('Bearer ')[1];

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

  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  let user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: decoded.email || '',
        name: decoded.name || '',
        firebaseUid: decoded.uid,
        avatarUrl: decoded.picture || '',
      },
    });
  }

  await prisma.$disconnect();
  return user;
}

@Injectable()
export class FirebaseGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    try {
      const user = await verifyAndGetUser(request);
      if (!user) throw new UnauthorizedException('No token provided');
      request.user = user;
      return true;
    } catch (error) {
      console.error('Auth error:', error.message);
      throw new UnauthorizedException('Invalid token');
    }
  }
}

@Injectable()
export class OptionalFirebaseGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    try {
      const user = await verifyAndGetUser(request);
      request.user = user; // null if no token, user object if valid
    } catch (error) {
      request.user = null; // Invalid token — still allow through
    }
    return true;
  }
}