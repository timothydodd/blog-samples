import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { GOOGLE_PLACES_API_KEY } from './services/google-places.token';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      provide: GOOGLE_PLACES_API_KEY,
      useValue: environment.google.placesApiKey,
    },
  ],
};
