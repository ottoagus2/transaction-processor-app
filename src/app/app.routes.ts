import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/transaction-parser',
    pathMatch: 'full'
  },
  {
    path: 'transaction-parser',
    loadComponent: () => import('./components/transaction-parser/transaction-parser.component')
      .then(m => m.TransactionParserComponent)
  },
  {
    path: 'file-matcher',
    loadComponent: () => import('./components/file-matcher/file-matcher.component')
      .then(m => m.FileMatcherComponent)
  },
  {
    path: '**',
    redirectTo: '/transaction-parser'
  }
];
