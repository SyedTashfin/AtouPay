import { colors } from '@/src/theme/colors';

export const shadows = {
  card: {
    shadowColor: '#0A291A',
    shadowOpacity: 0.08,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowRadius: 28,
    elevation: 3,
  },
  glass: {
    shadowColor: '#082619',
    shadowOpacity: 0.12,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowRadius: 36,
    elevation: 0,
  },
  soft: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.8,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowRadius: 18,
    elevation: 0,
  },
  button: {
    shadowColor: '#075F41',
    shadowOpacity: 0.18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowRadius: 18,
    elevation: 3,
  },
};
