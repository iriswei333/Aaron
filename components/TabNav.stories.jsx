import { fn } from 'storybook/test';

import { TabNav } from './TabNav';

import '../src/styles.css';

const meta = {
  title: 'Navigation/TabNav',
  component: TabNav,
  parameters: {
    layout: 'padded',
  },
  args: {
    onChange: fn(),
  },
};

export default meta;

export const HomeSelected = {
  args: {
    activeTab: 'home',
  },
};

export const SocialWithUnreadMessages = {
  args: {
    activeTab: 'social',
    unreadCounts: { social: 3 },
  },
};

export const FoodSelected = {
  args: {
    activeTab: 'food',
  },
};

