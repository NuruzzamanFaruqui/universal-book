import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import * as admin from 'firebase-admin';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: async (request, rawJwtToken, done) => {
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
          await admin.auth().verifyIdToken(rawJwtToken);
          done(null, 'firebase-verified');
        } catch (error) {
          done(error, null);
        }
      },
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findByFirebaseUid(payload.uid);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}