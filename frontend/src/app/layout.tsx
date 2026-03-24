import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CacaoPredict - Predicción del Precio del Cacao',
  description: 'Aplicación de predicción del precio del cacao usando ML/AI con análisis de factores climáticos, económicos y de mercado.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
