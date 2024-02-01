import { Injectable, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt/dist';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaCommands } from 'src/prisma/prisma.commands';
import * as argon from 'argon2';
import { Response } from 'express';

@Injectable()
export class TokenService {
    constructor(
        private config: ConfigService,
        private jwt: JwtService,
        private prisma: PrismaService,
        private prismaCommands: PrismaCommands,
    ) {}

    async refreshToken(username: string, @Res() response: Response) {
        await this.prisma.user.findUnique({
            where: {
                user: username,
            },
        });
        const user_token = await this.signToken(username);
        this.createCookies(response, user_token);
        const hashRefreshToken = await argon.hash(user_token.refreshToken);
        await this.prismaCommands.updateJwtToken(username, hashRefreshToken);
    }

    async signToken(
        user: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const payload = {
            sub: user,
        };

        const accessTokenSecret = this.config.get('JWT_SECRET_ACCESS');
        const refreshTokenSecret = this.config.get('JWT_SECRET_REFRESH');

        const accessToken = await this.jwt.signAsync(payload, {
            expiresIn: '15m',
            secret: accessTokenSecret,
        });

        const refreshToken = await this.jwt.signAsync(payload, {
            expiresIn: '30d',
            secret: refreshTokenSecret,
        });

        return { accessToken, refreshToken };
    }

    createCookies(@Res() response: Response, user_token: any) {
        response.cookie('accessToken', user_token.accessToken, {
            httpOnly: true,
            path: '/',
			maxAge: 15 * 60 * 1000,
            sameSite: 'strict',
        });
        response.cookie('refreshToken', user_token.refreshToken, {
            httpOnly: true,
            path: '/',
			maxAge: 30 * 24 * 60 * 60 * 1000,
            sameSite: 'strict',
        });
        return;
    }
}
