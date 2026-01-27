
import { Injectable } from '@angular/core';

// This interface is kept compatible with what components expect.
// We only need these fields for auto-filling the address.
export interface ViaCepResponse {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface BrasilApiResponse {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    service: string;
}


@Injectable({
  providedIn: 'root'
})
export class ViaCepService {
  private readonly baseUrl = 'https://brasilapi.com.br/api/cep/v1';

  async searchCep(cep: string): Promise<ViaCepResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${cep}`);
      
      // BrasilAPI returns a 404 for not found CEPs.
      if (!response.ok) {
        return null;
      }
      
      const data: BrasilApiResponse = await response.json();

      // Map BrasilAPI response to the existing ViaCepResponse structure
      // to avoid breaking changes in components.
      return {
        logradouro: data.street,
        bairro: data.neighborhood,
        localidade: data.city,
        uf: data.state,
        erro: false // Explicitly set erro to false for success cases.
      };
    } catch (error) {
      // This will catch network errors like the "Failed to fetch" (CORS) issue.
      console.error('Error fetching CEP:', error);
      return null;
    }
  }
}
