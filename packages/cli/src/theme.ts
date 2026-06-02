export type ThemeColors = {
  primary: string
  planMode: string
  selection: string
  selectionForeground: string
  thinking: string
  success: string
  error: string
  info: string
  background: string
  surface: string
  dialogSurface: string
  thinkingBorder: string
  dimSeperator: string
}


export type Theme = {
  name: string
  colors: ThemeColors
}

export const THEMES: Theme[] = [
  {
    name: 'NightFox',
    colors: {
      background:          '#192330',
      surface:             '#212e3f',
      dialogSurface:       '#253343',
      primary:             '#81a1c1',
      planMode:            '#c099ff',
      selection:           '#81a1c1',
      selectionForeground: '#192330',
      thinking:            '#fca7ea',
      success:             '#b8db87',
      error:               '#e26a75',
      info:                '#86e1fc',
      thinkingBorder:      '#c099ff',
      dimSeperator:        '#3b4a5a',
    }
  },
  {
    name: 'Claude Code',
    colors: {
      background:          '#0d1117',
      surface:             '#161b22',
      dialogSurface:       '#1c2128',
      primary:             '#d97757',
      planMode:            '#e8865c',
      selection:           '#d97757',
      selectionForeground: '#0d1117',
      thinking:            '#d97757',
      success:             '#3fb950',
      error:               '#f85149',
      info:                '#58a6ff',
      thinkingBorder:      '#d97757',
      dimSeperator:        '#21262d',
    }
  },
  {
    name: 'Catppuccin Mocha',
    colors: {
      background:          '#1e1e2e',
      surface:             '#181825',
      dialogSurface:       '#313244',
      primary:             '#cba6f7',
      planMode:            '#b4befe',
      selection:           '#cba6f7',
      selectionForeground: '#1e1e2e',
      thinking:            '#f5c2e7',
      success:             '#a6e3a1',
      error:               '#f38ba8',
      info:                '#89b4fa',
      thinkingBorder:      '#cba6f7',
      dimSeperator:        '#313244',
    }
  },
  {
    name: 'Tokyo Night',
    colors: {
      background:          '#1a1b2e',
      surface:             '#16213e',
      dialogSurface:       '#1f2c4a',
      primary:             '#7aa2f7',
      planMode:            '#bb9af7',
      selection:           '#7aa2f7',
      selectionForeground: '#1a1b2e',
      thinking:            '#ff9e64',
      success:             '#9ece6a',
      error:               '#f7768e',
      info:                '#7dcfff',
      thinkingBorder:      '#bb9af7',
      dimSeperator:        '#292e42',
    }
  },
  {
    name: 'Rosé Pine',
    colors: {
      background:          '#191724',
      surface:             '#1f1d2e',
      dialogSurface:       '#26233a',
      primary:             '#ebbcba',
      planMode:            '#c4a7e7',
      selection:           '#ebbcba',
      selectionForeground: '#191724',
      thinking:            '#f6c177',
      success:             '#31748f',
      error:               '#eb6f92',
      info:                '#9ccfd8',
      thinkingBorder:      '#c4a7e7',
      dimSeperator:        '#2a2837',
    }
  },
  {
    name: 'Neon Cyan',
    colors: {
      background:          '#010d12',
      surface:             '#051820',
      dialogSurface:       '#0a2535',
      primary:             '#00f5d4',
      planMode:            '#00c9a7',
      selection:           '#00f5d4',
      selectionForeground: '#010d12',
      thinking:            '#00d4ff',
      success:             '#00f5d4',
      error:               '#ff4d6d',
      info:                '#48cae4',
      thinkingBorder:      '#00f5d4',
      dimSeperator:        '#0d3347',
    }
  },
  {
    name: 'Hot Pink',
    colors: {
      background:          '#120010',
      surface:             '#1e0018',
      dialogSurface:       '#2e0026',
      primary:             '#ff2d78',
      planMode:            '#ff79c6',
      selection:           '#ff2d78',
      selectionForeground: '#ffffff',
      thinking:            '#ff79c6',
      success:             '#50fa7b',
      error:               '#ff5555',
      info:                '#bd93f9',
      thinkingBorder:      '#ff79c6',
      dimSeperator:        '#3d0030',
    }
  },
  {
    name: 'Electric Purple',
    colors: {
      background:          '#0d0015',
      surface:             '#160020',
      dialogSurface:       '#220030',
      primary:             '#bf5fff',
      planMode:            '#d97bff',
      selection:           '#bf5fff',
      selectionForeground: '#ffffff',
      thinking:            '#e0aaff',
      success:             '#57cc99',
      error:               '#ef233c',
      info:                '#7eb8f7',
      thinkingBorder:      '#bf5fff',
      dimSeperator:        '#2d003d',
    }
  },
  {
    name: 'Acid Green',
    colors: {
      background:          '#040d00',
      surface:             '#091a00',
      dialogSurface:       '#102600',
      primary:             '#aaff00',
      planMode:            '#7fff00',
      selection:           '#aaff00',
      selectionForeground: '#040d00',
      thinking:            '#c8ff57',
      success:             '#aaff00',
      error:               '#ff4444',
      info:                '#57ffd8',
      thinkingBorder:      '#aaff00',
      dimSeperator:        '#1a3300',
    }
  },
  {
    name: 'Sunset',
    colors: {
      background:          '#120c1c',
      surface:             '#1c1228',
      dialogSurface:       '#281a36',
      primary:             '#ff6b6b',
      planMode:            '#ffa07a',
      selection:           '#ff6b6b',
      selectionForeground: '#120c1c',
      thinking:            '#ffd93d',
      success:             '#6bcb77',
      error:               '#ff4d4d',
      info:                '#4d96ff',
      thinkingBorder:      '#ffd93d',
      dimSeperator:        '#2e1f3a',
    }
  },
  {
    name: 'Arctic',
    colors: {
      background:          '#0f1923',
      surface:             '#162433',
      dialogSurface:       '#1d3040',
      primary:             '#88c0d0',
      planMode:            '#81a1c1',
      selection:           '#88c0d0',
      selectionForeground: '#0f1923',
      thinking:            '#b48ead',
      success:             '#a3be8c',
      error:               '#bf616a',
      info:                '#5e81ac',
      thinkingBorder:      '#81a1c1',
      dimSeperator:        '#243342',
    }
  },
  {
    name: 'Dracula',
    colors: {
      background:          '#282a36',
      surface:             '#21222c',
      dialogSurface:       '#313341',
      primary:             '#bd93f9',
      planMode:            '#ff79c6',
      selection:           '#bd93f9',
      selectionForeground: '#282a36',
      thinking:            '#ffb86c',
      success:             '#50fa7b',
      error:               '#ff5555',
      info:                '#8be9fd',
      thinkingBorder:      '#ff79c6',
      dimSeperator:        '#44475a',
    }
  },
]

export const DEFAULT_THEME = THEMES.find((t) => t.name === 'NightFox')!
