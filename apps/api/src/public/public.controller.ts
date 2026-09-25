import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PublicService } from './public.service';
import { SubmitResponseDto } from './dto/submit-response.dto';

@Controller('public/evaluations')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('by-code/:code')
  getByCode(@Param('code') code: string) {
    return this.publicService.getByCode(code);
  }

  @Post(':code/responses')
  submit(@Param('code') code: string, @Body() dto: SubmitResponseDto) {
    return this.publicService.submit(code, dto);
  }
}
