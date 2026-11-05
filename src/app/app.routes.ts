import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth-guard';
import { BRAND } from './core/brand';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: `${BRAND.name}: ${BRAND.tagline}`,
    canActivate: [guestGuard],
    loadComponent: () => import('./features/landing/landing/landing').then(m => m.Landing),  },
  {
    path: 'login',
    title: `Sign in - ${BRAND.name}`,
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login),
  },
  {
    path: 'collection',
    title: `My collection - ${BRAND.name}`,
    canActivate: [authGuard],
    loadComponent: () => import('./features/items/item-list/item-list').then(m => m.ItemList),
  },
  {
    path: 'privacy',
    title: `Privacy Policy - ${BRAND.name}`,
    loadComponent: () => import('./features/legal/privacy/privacy').then(m => m.Privacy),
  },
  {
    path: 'terms',
    title: `Terms & Conditions - ${BRAND.name}`,
    loadComponent: () => import('./features/legal/terms/terms').then(m => m.Terms),
  },
  { path: '**', redirectTo: '' },
];
