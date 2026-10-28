import { Injectable, signal } from '@angular/core';
import { createClient, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Supabase {
  readonly client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  readonly session = signal<Session | null>(null);

  constructor() {
    this.client.auth.getSession().then(({ data }) => this.session.set(data.session));
    this.client.auth.onAuthStateChange((_event, session) => this.session.set(session));
  }
}
