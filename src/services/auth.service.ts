
import { Injectable, signal, inject, NgZone, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { DataService } from './data.service';
// FIX: The 'User' type is not consistently exported in all versions of '@supabase/supabase-js'.
// We derive it from the 'Session' type, which is reliably exported, to fix cascading type errors.
import { type Session } from '@supabase/supabase-js';
import { NotificationService } from './notification.service';

type User = NonNullable<Session['user']>;

export interface Address {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
}

export interface CompanyProfile {
  isCompanyProfileActive: boolean;
  name: string;
  taxIdType: 'cpf' | 'cnpj';
  taxId: string;
  tradeName?: string;
  email?: string;
  phone?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  logoUrl?: string;
  address: Address & { useUserAddress: boolean };
}

export interface UserProfile {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  avatar_url: string;
  role: 'company_admin' | 'user';
  pin?: string;
  cpf?: string;
  phone?: string;
  address?: Address;
  company_profile?: CompanyProfile;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private notificationService = inject(NotificationService);
  private ngZone = inject(NgZone);
  private injector = inject(Injector);
  private supabase = this.supabaseService.supabase;

  private isLoggingIn = signal(false);
  private isRecoveringPassword = false; // Flag to prevent auto-logout during recovery

  isAuthenticated = signal<boolean>(false);
  currentUser = signal<UserProfile | null>(null);

  constructor() {
    // CRITICAL: Check for recovery parameters in the URL immediately on startup.
    // This handles the case where Supabase redirects to the root with hash params (e.g., /#access_token=...&type=recovery)
    // preventing the AuthGuard's default redirect to login from taking precedence effectively or handling manual routing.
    const hash = window.location.hash;
    console.log('[AuthService] Startup Hash:', hash); // DEBUG
    if (hash && (hash.includes('type=recovery') || hash.includes('type=magiclink'))) {
      console.log('[AuthService] Recovery detected via Hash!'); // DEBUG
      this.isRecoveringPassword = true;
      // IMPORTANT: preserveFragment is essential! Without it, the router clears the access_token
      // from the URL before Supabase can read it, causing "Auth session missing".
      this.ngZone.run(() => this.router.navigate(['/reset-password'], { preserveFragment: true }));
    }

    this.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthService] Auth Event:', event); // DEBUG
      console.log('[AuthService] Session exists?', !!session); // DEBUG
      if (session) console.log('[AuthService] User ID:', session.user.id); // DEBUG

      const dataService = this.injector.get(DataService);

      this.ngZone.run(async () => {
        // Handle Password Recovery flow explicitly to prevent redirecting to login inappropriately
        if (event === 'PASSWORD_RECOVERY') {
          console.log('[AuthService] Handling PASSWORD_RECOVERY event'); // DEBUG
          this.isRecoveringPassword = true; // Set flag
          // Explicitly force navigation to the reset password page.
          this.ngZone.run(() => this.router.navigate(['/reset-password'], { preserveFragment: true }));
          return;
        }

        if (event === 'SIGNED_IN' && session) {
          // Attempt to fetch profile. RLS should now allow this even during recovery.
          const userProfile = await this.fetchUserProfile(session.user);

          if (userProfile) {
            this.currentUser.set(userProfile);
            this.isAuthenticated.set(true);
            await dataService.loadCompanyData();

            // Only navigate if this was triggered by an active login attempt.
            // If recovering, we stay on the current page (which we forced to /reset-password above)
            if (this.isLoggingIn()) {
              this.isLoggingIn.set(false); // Reset the flag
              this.router.navigate(['/dashboard']);
            }
          } else {
            // Couldn't fetch profile.
            // Only sign out if we are NOT in recovery mode. 
            // If recovering, we tolerate a missing profile to allow the password reset to proceed.
            if (!this.isRecoveringPassword) {
              await this.supabase.auth.signOut();
            }
          }
        } else if (event === 'SIGNED_OUT') {
          this.currentUser.set(null);
          this.isAuthenticated.set(false);
          this.isRecoveringPassword = false; // Reset flag on logout
          dataService.clearData();
          this.router.navigate(['/login']);
        }
      });
    });
  }

  private async fetchUserProfile(user: User): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    // Combine auth data (like email) with profile data
    return { ...data, email: user.email! } as UserProfile;
  }

  async login(email: string, password: string): Promise<{ success: boolean; error: string | null }> {
    this.isLoggingIn.set(true);
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Login error:', error.message);
      this.isLoggingIn.set(false); // Reset on error
      return { success: false, error: error.message };
    }
    // On success, onAuthStateChange will handle navigation and resetting the flag.
    return { success: true, error: null };
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  async register(fullName: string, companyName: string, email: string, password: string): Promise<boolean> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
        },
      },
    });

    if (error) {
      console.error('Registration error:', error.message);
      return false;
    }
    return true;
  }

  async forgotPassword(email: string): Promise<boolean> {
    // Use pure origin to avoid "Double Hash" issues (e.g. /#/reset-password#access_token=...)
    // We handle the routing manually in the constructor based on 'type=recovery' param.
    const redirectTo = window.location.origin;

    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo,
    });
    return !error;
  }

  async updateCurrentUser(updatedProfile: Partial<Omit<UserProfile, 'id' | 'email'>>): Promise<void> {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    // Deep merge for JSONB fields
    const newProfileData = {
      ...currentUser,
      ...updatedProfile,
      company_profile: updatedProfile.company_profile ? { ...currentUser.company_profile, ...updatedProfile.company_profile } : currentUser.company_profile,
    };

    // Prepare for DB update (remove fields that are not in user_profiles table)
    const { id, email, ...dbProfile } = newProfileData;

    const { data, error } = await this.supabase
      .from('user_profiles')
      .update(dbProfile)
      .eq('id', currentUser.id)
      .select()
      .single();

    if (error) {
      this.notificationService.show('Erro ao atualizar perfil.', 'error');
      console.error(error);
    } else if (data) {
      this.currentUser.set({ ...data, email: currentUser.email } as UserProfile);
      this.notificationService.show('Perfil atualizado!', 'success');
    }
  }

  async updateCurrentUserPin(pin: string): Promise<void> {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    const { error } = await this.supabase
      .from('user_profiles')
      .update({ pin })
      .eq('id', currentUser.id);

    if (error) {
      this.notificationService.show('Erro ao atualizar PIN.', 'error');
    } else {
      this.currentUser.update(user => user ? { ...user, pin } : null);
    }
  }

  async updateUserAvatar(avatarUrl: string): Promise<void> {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    const { error } = await this.supabase
      .from('user_profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', currentUser.id);

    if (error) {
      this.notificationService.show('Erro ao atualizar a foto de perfil.', 'error');
      console.error('Error updating avatar URL:', error);
    } else {
      // Add a timestamp to bust the cache and force the image to reload in the UI
      const cacheBustedUrl = `${avatarUrl}?t=${new Date().getTime()}`;
      this.currentUser.update(user => user ? { ...user, avatar_url: cacheBustedUrl } : null);
      this.notificationService.show('Foto de perfil atualizada com sucesso!', 'success');
    }
  }
}
