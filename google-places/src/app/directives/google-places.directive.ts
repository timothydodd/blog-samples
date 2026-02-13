/// <reference types="google.maps" />
import {
  Directive,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import { GooglePlaceAddress } from '../models/google-place-address';
import { GooglePlacesLoaderService } from '../services/google-places-loader.service';

@Directive({
  selector: '[libGooglePlaces]',
  host: {
    '(input)': 'onInput($event)',
    '(keydown)': 'onKeydown($event)',
    '(focus)': 'onFocus()',
    '[attr.autocomplete]': '"off"',
  },
})
export class GooglePlacesDirective implements OnInit, OnDestroy {
  placeChanged = output<GooglePlaceAddress>();

  private el = inject(ElementRef<HTMLInputElement>);
  private loader = inject(GooglePlacesLoaderService);

  private isLoaded = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private suggestions: google.maps.places.AutocompleteSuggestion[] = [];
  private selectedIndex = -1;
  private dropdownEl: HTMLDivElement | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  ngOnInit(): void {
    this.el.nativeElement.setAttribute('autocomplete', 'off');
    this.loader
      .load()
      .then(() => (this.isLoaded = true))
      .catch((err) => console.warn('Google Places not available:', err));
  }

  ngOnDestroy(): void {
    this.removeDropdown();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    if (!this.isLoaded || value.length < 3) {
      this.removeDropdown();
      return;
    }

    this.debounceTimer = setTimeout(() => this.fetchSuggestions(value), 300);
  }

  onFocus(): void {
    if (this.suggestions.length > 0) {
      this.showDropdown();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.dropdownEl || this.suggestions.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.suggestions.length - 1
        );
        this.updateSelection();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectSuggestion(this.suggestions[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.removeDropdown();
        break;
    }
  }

  private async fetchSuggestions(input: string): Promise<void> {
    try {
      const { suggestions } =
        await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
          {
            input,
            includedPrimaryTypes: [
              'street_address',
              'premise',
              'subpremise',
              'route',
            ],
            includedRegionCodes: ['us'],
            language: 'en',
          }
        );

      this.suggestions = suggestions;
      this.selectedIndex = -1;

      if (suggestions.length > 0) {
        this.showDropdown();
      } else {
        this.removeDropdown();
      }
    } catch {
      this.removeDropdown();
    }
  }

  private async selectSuggestion(
    prediction: google.maps.places.AutocompleteSuggestion
  ): Promise<void> {
    try {
      const place = prediction.placePrediction!.toPlace();
      await place.fetchFields({
        fields: ['addressComponents', 'formattedAddress'],
      });

      const address = this.parsePlace(place);
      this.el.nativeElement.value = address.streetAddress;

      this.placeChanged.emit(address);
      this.removeDropdown();
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  }

  private parsePlace(place: google.maps.places.Place): GooglePlaceAddress {
    const components = place.addressComponents || [];
    const get = (type: string, nameType: 'long' | 'short' = 'long') => {
      const component = components.find((c) => c.types.includes(type));
      return nameType === 'short'
        ? component?.shortText || ''
        : component?.longText || '';
    };

    const streetNumber = get('street_number');
    const route = get('route');

    return {
      streetNumber,
      route,
      streetAddress: [streetNumber, route].filter(Boolean).join(' '),
      city:
        get('locality') ||
        get('sublocality_level_1') ||
        get('administrative_area_level_2'),
      stateCode: get('administrative_area_level_1', 'short'),
      stateName: get('administrative_area_level_1'),
      postalCode: get('postal_code'),
      formattedAddress: place.formattedAddress || '',
    };
  }

  // --- Dropdown DOM management ---

  private showDropdown(): void {
    if (!this.dropdownEl) {
      this.createDropdown();
    }
    this.renderSuggestions();
    this.positionDropdown();
  }

  private createDropdown(): void {
    this.dropdownEl = document.createElement('div');
    this.dropdownEl.className = 'google-places-dropdown';
    document.body.appendChild(this.dropdownEl);

    this.outsideClickHandler = (e: MouseEvent) => {
      if (
        !this.dropdownEl?.contains(e.target as Node) &&
        e.target !== this.el.nativeElement
      ) {
        this.removeDropdown();
      }
    };
    document.addEventListener('mousedown', this.outsideClickHandler);
  }

  private renderSuggestions(): void {
    if (!this.dropdownEl) return;

    this.dropdownEl.innerHTML = this.suggestions
      .map((s, i) => {
        const prediction = s.placePrediction!;
        return `
          <div class="google-places-item${i === this.selectedIndex ? ' selected' : ''}"
               data-index="${i}">
            <span class="google-places-main">${prediction.mainText}</span>
            <span class="google-places-secondary"> ${prediction.secondaryText}</span>
          </div>`;
      })
      .join('');

    this.dropdownEl.querySelectorAll('.google-places-item').forEach((item) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const index = parseInt(
          (e.currentTarget as HTMLElement).dataset['index']!
        );
        this.selectSuggestion(this.suggestions[index]);
      });

      item.addEventListener('mouseenter', (e) => {
        this.selectedIndex = parseInt(
          (e.currentTarget as HTMLElement).dataset['index']!
        );
        this.updateSelection();
      });
    });
  }

  private positionDropdown(): void {
    if (!this.dropdownEl) return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    Object.assign(this.dropdownEl.style, {
      position: 'fixed',
      top: `${rect.bottom + 2}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: '10100',
    });
  }

  private updateSelection(): void {
    if (!this.dropdownEl) return;
    this.dropdownEl
      .querySelectorAll('.google-places-item')
      .forEach((item, i) => {
        item.classList.toggle('selected', i === this.selectedIndex);
      });
  }

  private removeDropdown(): void {
    if (this.dropdownEl) {
      this.dropdownEl.remove();
      this.dropdownEl = null;
    }
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    this.suggestions = [];
    this.selectedIndex = -1;
  }
}
