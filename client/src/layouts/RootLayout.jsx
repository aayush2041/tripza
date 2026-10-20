import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/Header.jsx';
import { Footer } from '../components/Footer.jsx';

export function RootLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: '1 0 auto', paddingBottom: 'var(--space-12)' }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
