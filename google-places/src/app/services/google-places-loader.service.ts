/// <reference types="google.maps" />
import { inject, Injectable } from '@angular/core';
import { GOOGLE_PLACES_API_KEY } from './google-places.token';

@Injectable({ providedIn: 'root' })
export class GooglePlacesLoaderService {
  private apiKey = inject(GOOGLE_PLACES_API_KEY, { optional: true });
  private loadPromise: Promise<void> | null = null;

  get hasApiKey(): boolean {
    return !!this.apiKey && this.apiKey !== 'YOUR_GOOGLE_API_KEY';
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    this.loadPromise = null;
  }

  load(): Promise<void> {
    if (!this.apiKey) {
      return Promise.reject('Google Places API key is not configured');
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    if (
      typeof google !== 'undefined' &&
      google.maps &&
      google.maps.places
    ) {
      this.loadPromise = Promise.resolve();
      return this.loadPromise;
    }

    this.loadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&v=weekly&loading=async`;
      script.async = true;
      script.defer = true;

      script.onload = () => resolve();
      script.onerror = () => {
        this.loadPromise = null;
        reject('Failed to load Google Maps script');
      };

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }
}
