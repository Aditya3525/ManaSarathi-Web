import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, Shield, X, Search, Command } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';

import { AdminBreadcrumbs, generateBreadcrumbs } from './components/AdminBreadcrumbs';
import { CommandPalette } from './components/CommandPalette';
import { NotificationBell } from './components/NotificationBell';
import { ThemeToggle, useTheme } from './components/ThemeToggle';

interface AdminShellNavItem {
  value: string;
  label: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
  description?: string;
  group?: string;
}

interface AdminShellProps {
  admin?: { email?: string | null; role?: string | null; name?: string | null } | null;
  onLogout?: () => void;
  navItems: AdminShellNavItem[];
  activeItem: string;
  onSelect: (value: string) => void;
  headerActions?: React.ReactNode;
  lastUpdatedLabel?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminShell({
  admin,
  onLogout,
  navItems,
  activeItem,
  onSelect,
  headerActions,
  lastUpdatedLabel,
  children
}: AdminShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { effectiveTheme, toggleTheme } = useTheme();

  // Keyboard shortcut for command palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      
      // G + key shortcuts for quick navigation
      if (
        e.key === 'g' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        const handleNextKey = (nextE: KeyboardEvent) => {
          const shortcuts: Record<string, string> = {
            'o': 'overview',
            'u': 'users',
            'c': 'content',
            'p': 'practices',
            'a': 'assessments',
            'n': 'analytics'
          };
          if (shortcuts[nextE.key]) {
            onSelect(shortcuts[nextE.key]);
          }
          document.removeEventListener('keydown', handleNextKey);
        };
        
        // Listen for next key within 500ms
        document.addEventListener('keydown', handleNextKey);
        setTimeout(() => {
          document.removeEventListener('keydown', handleNextKey);
        }, 500);
      }

      // T for theme toggle
      if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        toggleTheme();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSelect, toggleTheme]);

  const breadcrumbs = generateBreadcrumbs(activeItem, onSelect);

  const renderNavButton = (item: AdminShellNavItem, orientation: 'vertical' | 'horizontal') => {
    const isActive = item.value === activeItem;
    return (
      <Button
        key={item.value}
        type="button"
        variant={isActive ? 'secondary' : 'ghost'}
        className={cn(
          'w-full justify-start gap-3 text-sm font-medium transition-all duration-200',
          orientation === 'horizontal' && 'w-auto px-3 py-2',
          !isActive && 'text-muted-foreground hover:text-foreground hover:translate-x-1',
          isActive && 'bg-primary/10 text-primary border-l-2 border-primary'
        )}
        onClick={() => {
          onSelect(item.value);
          setMobileNavOpen(false);
        }}
      >
        <item.icon className={cn(
          'h-4 w-4 transition-transform duration-200',
          isActive && 'scale-110'
        )} aria-hidden="true" />
        <span>{item.label}</span>
        {item.badge ? (
          <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary">
            {item.badge}
          </span>
        ) : null}
      </Button>
    );
  };

  const renderNav = (orientation: 'vertical' | 'horizontal') => {
    if (orientation === 'horizontal') {
      return (
        <nav className="flex flex-row items-center gap-1">
          {navItems.map((item) => renderNavButton(item, orientation))}
        </nav>
      );
    }

    const groupedItems = navItems.reduce<Array<{ group: string; items: AdminShellNavItem[] }>>((acc, item) => {
      const groupName = item.group || 'Navigation';
      const existing = acc.find((group) => group.group === groupName);
      if (existing) {
        existing.items.push(item);
      } else {
        acc.push({ group: groupName, items: [item] });
      }
      return acc;
    }, []);

    return (
      <nav className="space-y-4">
        {groupedItems.map((group) => (
          <div key={group.group} className="space-y-1">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.group}
            </p>
            {group.items.map((item) => renderNavButton(item, orientation))}
          </div>
        ))}
      </nav>
    );
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-gradient-to-br from-muted/30 via-background to-muted/20 text-foreground transition-colors duration-300">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to content
      </a>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={onSelect}
        onLogout={onLogout}
        onToggleTheme={toggleTheme}
        currentTheme={effectiveTheme}
      />

      {/* Mobile navigation */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 grid grid-cols-[minmax(0,1fr)] lg:hidden">
          <div className="h-full w-full overflow-y-auto bg-background shadow-xl animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
                  <Shield className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Admin Console</p>
                  <p className="text-xs text-muted-foreground">Manage the platform</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="px-4 py-4 space-y-6">
              {/* Mobile search trigger */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={() => {
                  setMobileNavOpen(false);
                  setCommandPaletteOpen(true);
                }}
              >
                <Search className="h-4 w-4" />
                <span>Search...</span>
                <kbd className="ml-auto pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>

              {renderNav('vertical')}
              
              {admin ? (
                <div className="rounded-xl border bg-gradient-to-br from-muted/50 to-muted/30 p-3 text-sm">
                  <p className="font-medium">{admin.name || admin.email}</p>
                  <p className="text-muted-foreground">{admin.role || 'Administrator'}</p>
                </div>
              ) : null}
              
              {onLogout ? (
                <Button
                  variant="outline"
                  className="w-full justify-center text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                  onClick={() => {
                    onLogout();
                    setMobileNavOpen(false);
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="h-full w-full bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      ) : null}

      <div className="container mx-auto flex min-h-screen min-w-0 flex-col px-4 py-4 lg:flex-row lg:gap-8 lg:py-8">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-8 rounded-2xl border bg-background/80 backdrop-blur-md shadow-lg transition-all duration-300 hover:shadow-xl">
            {/* Logo section */}
            <div className="flex items-center gap-3 border-b px-5 py-5 bg-gradient-to-r from-primary/5 to-transparent rounded-t-2xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
                <Shield className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Admin Console</p>
                <p className="text-xs text-muted-foreground">Mental Wellbeing AI</p>
              </div>
            </div>

            <div className="px-3 py-4 space-y-4">
              {/* Search trigger */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground group"
                onClick={() => setCommandPaletteOpen(true)}
              >
                <Search className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span>Search...</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>

              {/* Navigation */}
              <div className="space-y-1">
                {renderNav('vertical')}
              </div>

              {/* Admin info */}
              {admin ? (
                <div className="space-y-2 rounded-xl border bg-gradient-to-br from-muted/50 to-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{admin.name || 'Admin'}</p>
                    {admin.role ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {admin.role}
                      </span>
                    ) : null}
                  </div>
                  {admin.email ? <p className="break-all text-xs text-muted-foreground">{admin.email}</p> : null}
                  {onLogout ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={onLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {/* Keyboard shortcuts hint */}
              <div className="text-[10px] text-muted-foreground/60 space-y-1 px-1">
                <p className="flex items-center gap-2">
                  <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">⌘K</kbd>
                  Command palette
                </p>
                <p className="flex items-center gap-2">
                  <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">T</kbd>
                  Toggle theme
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main id="admin-main-content" className="min-w-0 flex-1 space-y-4 lg:space-y-6">
          {/* Header */}
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/90 backdrop-blur-sm px-4 py-4 shadow-sm transition-all duration-300 hover:shadow-md sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                {/* Breadcrumbs */}
                <AdminBreadcrumbs items={breadcrumbs} className="mb-1" />
                <p className="text-base font-semibold sm:text-lg">Platform Administration</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {lastUpdatedLabel ? (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  {lastUpdatedLabel}
                </span>
              ) : null}
              
              {/* Theme toggle */}
              <ThemeToggle />
              
              {/* Notifications */}
              <NotificationBell />
              
              {/* Command palette trigger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden lg:flex"
                aria-label="Open command palette"
              >
                <Command className="h-4 w-4" />
              </Button>

              {headerActions ? <div className="flex flex-wrap items-center gap-2">{headerActions}</div> : null}
            </div>
          </header>

          {/* Content area */}
          <div className="min-w-0 rounded-2xl border bg-background/90 backdrop-blur-sm p-4 shadow-sm transition-all duration-300 hover:shadow-md sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
