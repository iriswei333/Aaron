import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHome } from '../src/tabs/home.js';

const child = {
  id: 'child-milo',
  name: 'Milo',
  ageMonths: 36,
  ageLabel: '36m',
  favoriteActivities: ['trucks'],
};

function stateWith(plans = []) {
  return {
    user: {
      displayName: 'Parent',
      childProfile: { activeChildId: child.id, children: [child], onboardingComplete: true },
    },
    savedFamilyPlans: plans,
    profilePlayDates: [],
    nearbyPlayOptions: [],
    weather: { label: 'Sunny', temperature: '68°' },
    showTodayStory: false,
  };
}

function render(state) {
  let html = '';
  renderHome({
    state,
    layout: (value) => { html = value; },
    renderCurrent: vi.fn(),
  });
  return html;
}

describe('Today tab primary section', () => {
  beforeEach(() => {
    globalThis.document = {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  });

  afterEach(() => {
    delete globalThis.document;
  });

  it('shows family plans in place of the adventure when a plan exists', () => {
    const html = render(stateWith([{
      id: 'plan-1',
      kind: 'external_event',
      status: 'planned',
      title: 'Park picnic',
      dueDate: '2099-08-18',
      venue: 'Green Lake',
    }]));
    expect(html).toContain('class="today-plans"');
    expect(html).toContain('class="today-plan-layout"');
    expect(html).toContain('class="today-plan-sidebar"');
    expect(html).toContain('class="today-plan-feature"');
    expect(html).not.toContain('class="today-adventure-grid"');
  });

  it('uses the saved event thumbnail and displays its details in the featured card', () => {
    const html = render(stateWith([{
      id: 'plan-2',
      kind: 'external_event',
      status: 'attending',
      title: 'Weekend train ride',
      summary: 'A miniature railway ride for families.',
      dueDate: '2099-08-18',
      venue: 'Meadow Station',
      metadata: {
        timeLabel: '10:00 AM–2:00 PM',
        imageUrl: 'https://images.example/train.jpg',
      },
    }]));

    expect(html).toContain("--today-plan-image: url('https://images.example/train.jpg')");
    expect(html).toContain('Weekend train ride');
    expect(html).toContain('Meadow Station');
    expect(html).toContain('A miniature railway ride for families.');
  });

  it('uses the matching host playground image for a featured playdate', () => {
    const state = stateWith();
    state.profilePlayDates = [{
      id: 'playdate-1',
      playgroundKey: 'sunny-park',
      playgroundName: 'Sunny Park',
      playgroundAddress: '100 Park Lane',
      startsAt: '2099-08-18T17:00:00.000Z',
      endsAt: '2099-08-18T19:00:00.000Z',
      status: 'upcoming',
      isHost: true,
    }];
    state.nearbyPlayOptions = [{
      key: 'sunny-park',
      name: 'Sunny Park',
      imageUrl: 'https://images.example/sunny-park.jpg',
    }];

    const html = render(state);
    expect(html).toContain("--today-plan-image: url('https://images.example/sunny-park.jpg')");
    expect(html).toContain('100 Park Lane');
  });

  it('uses a default background when a story time has no thumbnail', () => {
    const html = render(stateWith([{
      id: 'plan-3',
      kind: 'story_time',
      status: 'planned',
      title: 'Toddler story time',
      dueDate: '2099-08-18',
      venue: 'Central Library',
    }]));

    expect(html).toContain("--today-plan-image: url('/backgrounds/parenting-home-default.png')");
  });

  it('shows the adventure and getting-ready story action without a plan', () => {
    const html = render(stateWith());
    expect(html).toContain('class="today-adventure-grid"');
    expect(html).toContain('data-open-today-story');
    expect(html).not.toContain('class="today-plans"');
  });
});
