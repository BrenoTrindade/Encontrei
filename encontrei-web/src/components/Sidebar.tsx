import { Box, Typography, Divider, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { Beach } from '../data/beachData';

interface SidebarProps {
  selectedBeach: Beach | null;
  tideFilter: string;
  onTideFilterChange: (tide: string) => void;
}

const Sidebar = ({ selectedBeach, tideFilter, onTideFilterChange }: SidebarProps) => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Filters
      </Typography>
      <FormControl fullWidth>
        <InputLabel id="tide-filter-label">Tide</InputLabel>
        <Select
          labelId="tide-filter-label"
          id="tide-filter"
          value={tideFilter}
          label="Tide"
          onChange={(e) => onTideFilterChange(e.target.value)}
        >
          <MenuItem value="All">All</MenuItem>
          <MenuItem value="High">High</MenuItem>
          <MenuItem value="Low">Low</MenuItem>
        </Select>
      </FormControl>
      <Divider sx={{ my: 2 }} />
      <Typography variant="h6" gutterBottom>
        Details
      </Typography>
      {selectedBeach ? (
        <Box>
          <Typography variant="h5" component="div">
            {selectedBeach.name}
          </Typography>
          <Typography color="text.secondary">
            Tide: {selectedBeach.tide}
          </Typography>
          {/* Add more details here as they become available */}
        </Box>
      ) : (
        <Box>
          <Typography variant="body1">
            Click on a marker to see details.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Sidebar;
