import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Usuario } from '@entities/usuario.entity';

export const GetUser = createParamDecorator(
  (data: string, ctx: ExecutionContext): Usuario => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
