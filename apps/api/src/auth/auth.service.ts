import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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
