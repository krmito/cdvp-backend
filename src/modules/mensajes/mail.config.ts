import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

export const MailerModuleConfig = MailerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mailUser = config.get<string>('MAIL_USER');
    const mailPassword = config.get<string>('MAIL_PASSWORD');

    // Si no hay credenciales SMTP, usar transport JSON (solo loguea, no envía)
    // Log para verificar configuración al iniciar
    console.log(`[MailerModule] MAIL_USER configurado: ${mailUser ? 'Sí' : 'No'}`);

    const transport =
      mailUser && mailPassword
        ? {
            host: config.get<string>('MAIL_HOST', 'smtp.gmail.com'),
            port: config.get<number>('MAIL_PORT', 587),
            secure: false,
            auth: {
              user: mailUser,
              pass: mailPassword,
            },
            tls: {
              rejectUnauthorized: false,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
          }
        : {
            jsonTransport: true,
          };

    return {
      transport,
      defaults: {
        from: config.get<string>(
          'MAIL_FROM',
          '"Club Deportivo" <noreply@club.com>',
        ),
      },
      template: {
        dir: join(__dirname, 'templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    };
  },
});
