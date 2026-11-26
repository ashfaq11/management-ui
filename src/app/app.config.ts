import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { loadConfig } from './core/config';
import { authInterceptor } from './core/http';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes),
    provideAppInitializer(loadConfig), provideHttpClient(withInterceptors([authInterceptor]))],
};
