import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    title: 'Heart Dog Homestead Heirloom Seeds',
  },
  {
    path: 'shop',
    loadComponent: () => import('./pages/shop/shop').then((m) => m.Shop),
    title: 'Shop Seeds — Heart Dog Homestead',
  },
  {
    path: 'shop/:slug',
    loadComponent: () =>
      import('./pages/product-detail/product-detail').then((m) => m.ProductDetail),
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart').then((m) => m.Cart),
    title: 'Your Cart — Heart Dog Homestead',
  },
  {
    path: 'checkout/success',
    loadComponent: () =>
      import('./pages/checkout-success/checkout-success').then((m) => m.CheckoutSuccess),
    title: 'Order Confirmed — Heart Dog Homestead',
  },
  {
    path: 'donate',
    loadComponent: () => import('./pages/donate/donate').then((m) => m.Donate),
    title: 'Give Back — Heart Dog Homestead',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    title: 'Sign In — Heart Dog Homestead',
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
    title: 'Create an Account — Heart Dog Homestead',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
    title: 'Reset Your Password — Heart Dog Homestead',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
    title: 'Choose a New Password — Heart Dog Homestead',
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/account').then((m) => m.Account),
    title: 'Your Account — Heart Dog Homestead',
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
    title: 'Page Not Found — Heart Dog Homestead',
  },
];
