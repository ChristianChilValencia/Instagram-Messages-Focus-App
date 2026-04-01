import { Injectable } from '@angular/core';
import { InAppBrowser } from '@capacitor/inappbrowser';
import { Preferences } from '@capacitor/preferences';
import { Platform } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root',
})
export class InstagramRedirectService {
  private currentPath: string = '/direct/';
  private readonly PREF_KEY = 'instagram_last_route';
  private readonly INSTAGRAM_BASE = 'https://www.instagram.com';
  private listenersBound = false;
  private browserOpen = false;
  private opening = false;
  private redirecting = false;
  private intentionalClose = false;

  constructor(private platform: Platform) {}

  async openInstagram(): Promise<void> {
    try {
      const startPath = await this.getStartPath();
      this.currentPath = startPath;

      if (this.platform.is('capacitor')) {
        await this.ensureListeners();
        await this.openAtPath(startPath);
      } else {
        this.openWithWindowOpen(`${this.INSTAGRAM_BASE}${startPath}`);
      }
    } catch (error) {
      console.error('[Instagram] openInstagram error:', error);
    }
  }

  // Called by HomePage when app regains focus so the blank page never stays visible.
  async ensureBrowserOpen(): Promise<void> {
    if (!this.platform.is('capacitor')) {
      return;
    }

    if (this.browserOpen || this.opening || this.redirecting) {
      return;
    }

    await this.ensureListeners();
    await this.openAtPath(this.currentPath);
  }

  private async getStartPath(): Promise<string> {
    // Always start at /direct/. If user is not logged in, Instagram sends them to /accounts/login/.
    return '/direct/';
  }

  private async ensureListeners(): Promise<void> {
    if (this.listenersBound) {
      return;
    }

    await InAppBrowser.addListener('browserPageNavigationCompleted', async (data: any) => {
      const fullUrl = data?.url || '';
      await this.handleNavigation(fullUrl);
    });

    await InAppBrowser.addListener('browserPageLoaded', async () => {
      this.browserOpen = true;
      console.log('[Instagram] page loaded');
    });

    await InAppBrowser.addListener('browserClosed', async () => {
      this.browserOpen = false;
      console.log('[Instagram] browser closed');

      if (this.intentionalClose) {
        this.intentionalClose = false;
        return;
      }

      // If Android back closes InAppBrowser, immediately reopen to avoid blank app page.
      await this.ensureBrowserOpen();
    });

    this.listenersBound = true;
  }

  private async openAtPath(path: string): Promise<void> {
    const normalized = this.normalizePathForOpen(path);
    const url = `${this.INSTAGRAM_BASE}${normalized}`;

    this.opening = true;
    try {
      await InAppBrowser.openInWebView({
        url,
        options: {
          showURL: false,
          showToolbar: false,
          clearCache: false,
          clearSessionCache: false,
          mediaPlaybackRequiresUserAction: false,
          closeButtonText: 'Close',
          toolbarPosition: 0,
          showNavigationButtons: false,
          leftToRight: false,
          android: {
            allowZoom: false,
            hardwareBack: false,
            pauseMedia: false,
          },
          iOS: {
            allowOverScroll: false,
            enableViewportScale: false,
            allowInLineMediaPlayback: false,
            surpressIncrementalRendering: false,
            viewStyle: 2,
            animationEffect: 1,
            allowsBackForwardNavigationGestures: false,
          },
        },
      });

      this.browserOpen = true;
      this.currentPath = normalized;
      await this.persistRoute(normalized);
      console.log('[Instagram] opened:', normalized);
    } finally {
      this.opening = false;
    }
  }

  private async handleNavigation(fullUrl: string): Promise<void> {
    const parsed = this.parseUrl(fullUrl);
    if (!parsed) {
      await this.redirectTo(this.getRedirectTarget(this.currentPath));
      return;
    }

    const { host, path } = parsed;
    const cleanPathForCheck = this.normalizePathForCheck(path);

    const hostAllowed = host === 'www.instagram.com' || host === 'instagram.com';
    const pathAllowed = this.isAllowedRoute(cleanPathForCheck);

    if (hostAllowed && pathAllowed) {
      const routeToStore = this.normalizePathForOpen(cleanPathForCheck);
      this.currentPath = routeToStore;
      await this.persistRoute(routeToStore);
      return;
    }

    const target = this.getRedirectTarget(this.currentPath);
    await this.redirectTo(target);
  }

  private async redirectTo(path: string): Promise<void> {
    if (this.redirecting) {
      return;
    }

    this.redirecting = true;
    try {
      const target = this.normalizePathForOpen(path);
      this.currentPath = target;
      await this.persistRoute(target);

      this.intentionalClose = true;
      await InAppBrowser.close();
      await new Promise((resolve) => setTimeout(resolve, 120));
      await this.openAtPath(target);

      console.log('[Instagram] redirected to:', target);
    } catch (error) {
      console.error('[Instagram] redirect error:', error);
    } finally {
      this.redirecting = false;
    }
  }

  /**
   * Web fallback
   */
  private openWithWindowOpen(startUrl: string): void {
    window.location.href = startUrl;
  }

  private parseUrl(fullUrl: string): { host: string; path: string } | null {
    try {
      const url = new URL(fullUrl);
      return { host: url.hostname.toLowerCase(), path: url.pathname || '/' };
    } catch {
      return null;
    }
  }

  private isAllowedRoute(path: string): boolean {
    const lower = path.toLowerCase();
    if (lower === '/accounts/login/' || lower.startsWith('/accounts/login/')) return true;
    if (lower === '/accounts/settings/' || lower.startsWith('/accounts/settings/')) return true;
    if (lower === '/direct/' || lower.startsWith('/direct/')) return true;
    if (lower.startsWith('/p/')) return true;
    return false;
  }

  private getRedirectTarget(currentPath: string): string {
    const p = currentPath.toLowerCase();
    if (p.startsWith('/direct/')) return '/accounts/settings/';
    if (p.startsWith('/accounts/settings/')) return '/direct/';
    return '/direct/';
  }

  private normalizePathForCheck(path: string): string {
    let out = (path || '/').trim();
    if (!out.startsWith('/')) {
      out = `/${out}`;
    }

    // Strip query/hash if they appear in a raw string input.
    out = out.split('?')[0].split('#')[0];

    // Keep root as root so it remains BLOCKED.
    if (out === '' || out === '/') {
      return '/';
    }

    return out;
  }

  private normalizePathForOpen(path: string): string {
    const checked = this.normalizePathForCheck(path);

    if (checked === '/') return '/direct/';

    let out = checked;

    if (out === '/direct') return '/direct/';
    if (out === '/accounts/settings') return '/accounts/settings/';
    if (out === '/accounts/login') return '/accounts/login/';
    if (out === '/p') return '/p/';

    // Ensure trailing slash for stable matching on top-level sections.
    if (out === '/direct' || out === '/direct/') return '/direct/';
    if (out === '/accounts/login' || out === '/accounts/login/') return '/accounts/login/';
    if (out === '/accounts/settings' || out === '/accounts/settings/') return '/accounts/settings/';

    return out;
  }

  /**
   * Save route to storage
   */
  private async persistRoute(path: string): Promise<void> {
    try {
      const finalPath = this.normalizePathForOpen(path);
      await Preferences.set({
        key: this.PREF_KEY,
        value: finalPath,
      });
    } catch (error) {
      console.error('[Instagram] Save error:', error);
    }
  }

  /**
   * Close browser
   */
  async closeBrowser(): Promise<void> {
    try {
      await InAppBrowser.close();
    } catch (error) {
      console.error('[Instagram] Close error:', error);
    }
  }
}
