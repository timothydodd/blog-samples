import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { GooglePlacesDirective } from './directives/google-places.directive';
import { GooglePlaceAddress } from './models/google-place-address';
import { GooglePlacesLoaderService } from './services/google-places-loader.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, ReactiveFormsModule, GooglePlacesDirective, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  form: FormGroup;
  selectedAddress: GooglePlaceAddress | null = null;
  apiKeyReady = signal(false);
  apiKeyInput = '';

  private loader = inject(GooglePlacesLoaderService);

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      streetAddress: [''],
      city: [''],
      state: [''],
      zipCode: [''],
    });

    this.apiKeyReady.set(this.loader.hasApiKey);
  }

  submitApiKey(): void {
    const key = this.apiKeyInput.trim();
    if (key) {
      this.loader.setApiKey(key);
      this.apiKeyReady.set(true);
    }
  }

  onAddressSelected(address: GooglePlaceAddress): void {
    this.selectedAddress = address;

    this.form.patchValue({
      streetAddress: address.streetAddress,
      city: address.city,
      state: address.stateCode,
      zipCode: address.postalCode,
    });

    Object.keys(this.form.controls).forEach((key) => {
      this.form.get(key)?.markAsDirty();
    });
  }
}
