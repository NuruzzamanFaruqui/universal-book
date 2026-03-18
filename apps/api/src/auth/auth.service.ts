import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as admin from 'firebase-admin';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  private getFirebaseApp() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
    return admin.app();
  }

  async verifyFirebaseToken(token: string) {
    try {
      const app = this.getFirebaseApp();
      const decodedToken = await app.auth().verifyIdToken(token);
      return decodedToken;
    } catch (error) {
      throw new UnauthorizedException('Invalid Firebase token');
    }
  }

  async loginOrRegister(token: string) {
    const decodedToken = await this.verifyFirebaseToken(token);

    let user = await this.usersService.findByFirebaseUid(decodedToken.uid);

    if (!user) {
      user = await this.usersService.createUser({
        email: decodedToken.email || '',
        name: decodedToken.name || '',
        firebaseUid: decodedToken.uid,
        avatarUrl: decodedToken.picture || '',
      });
    }

    return user;
  }
}