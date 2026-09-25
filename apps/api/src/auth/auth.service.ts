import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!teacher) {
      throw new UnauthorizedException('Ugyldig e-mail eller adgangskode');
    }
    const ok = await bcrypt.compare(dto.password, teacher.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Ugyldig e-mail eller adgangskode');
    }
    return this.tokenResponse(teacher.id, teacher.email, teacher.name);
  }

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const teacher = await this.prisma.teacher.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
      },
    });
    return this.tokenResponse(teacher.id, teacher.email, teacher.name);
  }

  async me(teacherId: string) {
    return this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        email: true,
        name: true,
        externalId: true,
        createdAt: true,
      },
    });
  }

  private tokenResponse(id: string, email: string, name: string) {
    const accessToken = this.jwtService.sign({
      sub: id,
      email,
      name,
    });
    return {
      accessToken,
      teacher: { id, email, name },
    };
  }
}
