import { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import theme from './theme';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import { Beach, beaches } from './data/beachData';

const drawerWidth = 240;

function App() {
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [tideFilter, setTideFilter] = useState('All');

  const handleTideFilterChange = (tide: string) => {
    setTideFilter(tide);
    setSelectedBeach(null); // Reset selection when filter changes
  };

  const filteredBeaches = beaches.filter(beach => {
    if (tideFilter === 'All') {
      return true;
    }
    return beach.tide === tideFilter;
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
          variant="permanent"
          anchor="left"
        >
          <Toolbar />
          <Sidebar 
            selectedBeach={selectedBeach} 
            tideFilter={tideFilter}
            onTideFilterChange={handleTideFilterChange}
          />
        </Drawer>
        <Box
          component="main"
          sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}
        >
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" noWrap component="div">
                Encontrei 🔎
              </Typography>
            </Toolbar>
          </AppBar>
          <Box sx={{ flexGrow: 1 }}>
            <Map beaches={filteredBeaches} onBeachSelect={setSelectedBeach} />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
