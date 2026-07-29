'use client';

import React from 'react';

export const TAB_ITEMS = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'play', icon: '🛝', label: 'Play' },
  { key: 'food', icon: '🥣', label: 'Food' },
  { key: 'errands', icon: '🛒', label: 'Errands' },
  { key: 'social', icon: '📷', label: 'Social' },
];

export function TabNav({ activeTab = 'home', unreadCounts = {}, onChange }) {
  return (
    <nav className="tabs" aria-label="Planner sections">
      {TAB_ITEMS.map((item) => {
        const unreadCount = Number(unreadCounts[item.key] || 0);
        const isActive = activeTab === item.key;

        return (
          <button
            key={item.key}
            type="button"
            className={isActive ? 'active' : ''}
            aria-current={isActive ? 'page' : undefined}
            aria-label={unreadCount > 0 ? `${item.label}, ${unreadCount} unread` : item.label}
            onClick={() => onChange?.(item.key)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
            {unreadCount > 0 && (
              <span className="tab-unread" aria-hidden="true">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

