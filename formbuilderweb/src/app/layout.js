import '../styles/globals.css';
import '../styles/layout.css';
import '../styles/sidebar.css';
import '../styles/topbar.css';
import '../styles/table.css';
import '../styles/forms.css';
import '../styles/modal.css';
import '../styles/buttons.css';
import '../styles/badges.css';
import '../styles/utilities.css';
import '../styles/google-forms.css';

import LayoutShell from '@/components/LayoutShell';
import { AppProvider } from '@/lib/AppContext';

export const metadata = {
  title: 'FormBuilder – Google Forms Clone',
  description: 'Build and share forms, collect responses',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </head>
      <body>
        <AppProvider>
          <LayoutShell>{children}</LayoutShell>
        </AppProvider>
      </body>
    </html>
  );
}
