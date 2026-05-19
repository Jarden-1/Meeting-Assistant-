import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    if (process.env.NODE_ENV === 'production' && this.config.get<string>('AUTH_NAME_LOGIN_ENABLED') !== 'true') {
      throw new Error('AUTH_NAME_LOGIN_ENABLED=true must be set to use name-only login in production');
    }
  }

  async enter(rawEntryName: string) {
    const entryName = rawEntryName.trim();
    const user = await this.prisma.user.upsert({
      where: { entryName },
      create: {
        entryName,
        displayName: entryName,
      },
      update: {
        displayName: entryName,
      },
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      entryName: user.entryName,
      displayName: user.displayName,
    });

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        entryName: user.entryName,
      },
      accessToken,
    };
  }
}
