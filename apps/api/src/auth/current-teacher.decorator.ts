import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTeacher = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as { id: string; email: string; name: string };
  },
);
