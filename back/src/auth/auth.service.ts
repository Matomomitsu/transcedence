import { ForbiddenException, Injectable, Res } from '@nestjs/common';
import { AuthDto, SigninDto } from 'src/dto/auth.dto';
import * as argon from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaCommands } from 'src/prisma/prisma.commands';
import { TokenService } from 'src/token/token.service';
import { Response } from 'express';
import { ImageService } from './auth.controller';

@Injectable({})
export class AuthService {
	constructor(
		private prisma: PrismaService,
		private prismaCommands: PrismaCommands,
		private token: TokenService,
	) { }

	async signup(dto: AuthDto, @Res() response: Response) {
		const hash = await argon.hash(dto.password);

		try {
			const user = await this.prisma.user.create({
				data: {
					email: dto.email,
					hash,
					user: dto.user,
					profileImage: dto.profileImage, // Adicione o profileImage aqui
				},
			});
			const user_token = await this.token.signToken(user.user);
			this.token.createCookies(response, user_token);
			const hashRefreshToken = await argon.hash(user_token.refreshToken);
			await this.prismaCommands.updateJwtToken(user.user, hashRefreshToken);
		} catch (error) {
			if (error instanceof PrismaClientKnownRequestError) {
				if (error.code === 'P2002') {
					throw new ForbiddenException('Credentials already exists');
				}
			}
			throw error;
		}
	}

	async signin(dto: SigninDto, @Res() response: Response) {
		const user = await this.prisma.user.findUnique({
			where: {
				user: dto.user,
			},
		});
		console.log(user);
		if (!user) throw new ForbiddenException('User Incorect');
		if (!user.hash) throw new ForbiddenException('Intra user');
		const pwMatches = await argon.verify(user.hash, dto.password);
		if (!pwMatches) throw new ForbiddenException('Password Incorrect');
		const user_token = await this.token.signToken(user.user);
		this.token.createCookies(response, user_token);
		const hashRefreshToken = await argon.hash(user_token.refreshToken);
		await this.prismaCommands.updateJwtToken(user.user, hashRefreshToken);
	}
}
