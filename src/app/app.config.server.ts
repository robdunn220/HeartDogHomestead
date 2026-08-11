import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE } from './core/api.service';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // During rendering there is no page origin to resolve a relative URL
    // against, so API calls need an absolute one.
    {
      provide: API_BASE,
      useValue: (
        process.env['SITE_URL'] || `http://localhost:${process.env['PORT'] || 4000}`
      ).replace(/\/$/, ''),
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
