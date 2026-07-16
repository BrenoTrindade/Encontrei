import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#075985',
      dark: '#0c4a6e',
      light: '#e0f2fe',
    },
    secondary: {
      main: '#0f766e',
    },
    success: {
      main: '#16765b',
      dark: '#0f6049',
    },
    warning: {
      main: '#b56a00',
      dark: '#8a5000',
    },
    background: {
      default: '#f5f8fa',
      paper: '#ffffff',
    },
    text: {
      primary: '#102a38',
      secondary: '#526773',
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h3: {
      fontSize: 'clamp(1.8rem, 5vw, 2.5rem)',
      lineHeight: 1.12,
      fontWeight: 800,
      letterSpacing: '-0.03em',
    },
    h4: {
      fontSize: 'clamp(1.6rem, 4vw, 2.1rem)',
      fontWeight: 800,
      letterSpacing: '-0.025em',
    },
    h5: {
      fontWeight: 800,
    },
    h6: {
      fontWeight: 800,
    },
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 8px 30px rgba(16, 42, 56, 0.06)',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
        },
      },
    },
  },
});

export default theme;
