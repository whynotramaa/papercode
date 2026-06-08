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
  foreground: string
  dim: string
  secondaryForeground: string
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
      foreground:          '#c5cdd9',
      dim:                 '#7a8a9b',
      secondaryForeground: '#56687a',
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
      foreground:          '#c9d1d9',
      dim:                 '#768390',
      secondaryForeground: '#545d68',
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
      foreground:          '#cdd6f4',
      dim:                 '#7f849c',
      secondaryForeground: '#585b70',
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
      foreground:          '#c0caf5',
      dim:                 '#737aa2',
      secondaryForeground: '#565f89',
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
      foreground:          '#e0def4',
      dim:                 '#908caa',
      secondaryForeground: '#6e6a86',
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
      foreground:          '#c2e8e0',
      dim:                 '#5a8a7e',
      secondaryForeground: '#3d6860',
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
      foreground:          '#f0d0e8',
      dim:                 '#9a6888',
      secondaryForeground: '#7a4868',
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
      foreground:          '#e0d0f0',
      dim:                 '#8a70a8',
      secondaryForeground: '#6a5088',
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
      foreground:          '#d5f0c0',
      dim:                 '#7a9a58',
      secondaryForeground: '#5a7a40',
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
      foreground:          '#e8d8f0',
      dim:                 '#8a7898',
      secondaryForeground: '#6a5878',
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
      foreground:          '#d8dee9',
      dim:                 '#6d8099',
      secondaryForeground: '#4c6078',
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
      foreground:          '#f8f8f2',
      dim:                 '#7a7e8e',
      secondaryForeground: '#5a5e6e',
    }
  },
  {
    name: 'Gruvbox',
    colors: {
      background:          '#282828',
      surface:             '#3c3836',
      dialogSurface:       '#504945',
      primary:             '#d79921',
      planMode:            '#fe8019',
      selection:           '#d79921',
      selectionForeground: '#282828',
      thinking:            '#fe8019',
      success:             '#98971a',
      error:               '#cc241d',
      info:                '#458588',
      thinkingBorder:      '#fe8019',
      dimSeperator:        '#504945',
      foreground:          '#ebdbb2',
      dim:                 '#928374',
      secondaryForeground: '#7c6f64',
    }
  },
  {
    name: 'RCB Special',
    colors: {
      background:          '#1a0a0a',
      surface:             '#2a1010',
      dialogSurface:       '#3a1515',
      primary:             '#ffd700',
      planMode:            '#ff8c00',
      selection:           '#ffd700',
      selectionForeground: '#1a0a0a',
      thinking:            '#ffb347',
      success:             '#32cd32',
      error:               '#ee0033',
      info:                '#87ceeb',
      thinkingBorder:      '#ffd700',
      dimSeperator:        '#3a2020',
      foreground:          '#f5e6cc',
      dim:                 '#a08080',
      secondaryForeground: '#805050',
    }
  },
  {
    name: 'Paper Light',
    colors: {
      background:          '#faf8f5',
      surface:             '#f0ece6',
      dialogSurface:       '#e8e4de',
      primary:             '#2563eb',
      planMode:            '#7c3aed',
      selection:           '#2563eb',
      selectionForeground: '#ffffff',
      thinking:            '#d97706',
      success:             '#16a34a',
      error:               '#dc2626',
      info:                '#0891b2',
      thinkingBorder:      '#d97706',
      dimSeperator:        '#d6d0c8',
      foreground:          '#1c1917',
      dim:                 '#78716c',
      secondaryForeground: '#a8a29e',
    }
  },
  {
    name: 'GitHub Light',
    colors: {
      background:          '#ffffff',
      surface:             '#f6f8fa',
      dialogSurface:       '#eaeef2',
      primary:             '#0969da',
      planMode:            '#8250df',
      selection:           '#0969da',
      selectionForeground: '#ffffff',
      thinking:            '#bf8700',
      success:             '#1a7f37',
      error:               '#cf222e',
      info:                '#0969da',
      thinkingBorder:      '#bf8700',
      dimSeperator:        '#d0d7de',
      foreground:          '#1f2328',
      dim:                 '#656d76',
      secondaryForeground: '#8b949e',
    }
  },
]

export const DEFAULT_THEME = THEMES.find((t) => t.name === 'NightFox')!
