'use client';

import React from 'react';

export const TAB_ITEMS = [
  { key: 'home', codePoint: 0x1f3e0, fallback: '🏠', label: 'Home' },
  { key: 'play', codePoint: 0x1f6dd, fallback: '🛝', label: 'Play' },
  { key: 'chat', codePoint: 0x1f4ac, fallback: '💬', label: 'Chat' },
  { key: 'profile', codePoint: 0x1f46a, fallback: '👪', label: 'Family' },
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
            <span className="tab-emoji" role="img" aria-label={item.label}>
              {String.fromCodePoint(item.codePoint) || item.fallback}
            </span>
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
