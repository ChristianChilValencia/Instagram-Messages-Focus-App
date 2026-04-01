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

  // Allowed routes
  private readonly ALLOWED_ROUTES = ['/direct/', '/p/', '/settings/', '/accounts/login/'];

  constructor(private platform: Platform) {}

  /**
   * Open Instagram in InAppBrowser with route monitoring
   */
  async openInstagram(): Promise<void> {
    try {
      // Restore last visited route
      const lastRoute = await this.getLastRoute();
      const startUrl = `${this.INSTAGRAM_BASE}${lastRoute}`;

      // Check platform to determine loading method
      if (this.platform.is('capacitor')) {
        await this.openWithInAppBrowser(startUrl);
      } else {
        // Web fallback
        this.openWithWindowOpen(startUrl);
      }
    } catch (error) {
      console.error('Error opening Instagram:', error);
    }
  }

  /**
   * Open Instagram using native InAppBrowser plugin
   */
  private async openWithInAppBrowser(startUrl: string): Promise<void> {
    try {
      // Set up event listeners before opening
      const navigationListener = await InAppBrowser.addListener(
        'browserPageNavigationCompleted',
        (data: any) => {
          this.handleNavigationEvent(data.url);
        }
      );

      const loadedListener = await InAppBrowser.addListener('browserPageLoaded', async () => {
        if (this.currentPath) {
          await this.persistRoute(this.currentPath);
        }
      });

      const closedListener = await InAppBrowser.addListener('browserClosed', async () => {
        // Browser closed, persist final route
        await this.persistRoute(this.currentPath);
        // Clean up listeners
        navigationListener.remove();
        loadedListener.remove();
        closedListener.remove();
      });

      // Open in web view
      await InAppBrowser.openInWebView({
        url: startUrl,
        options: {
          showURL: false,
          showToolbar: false,
          clearCache: false,
          clearSessionCache: false,
          mediaPlaybackRequiresUserAction: false,
          closeButtonText: 'Close',
          toolbarPosition: 0, // TOP
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
            viewStyle: 2, // FULL_SCREEN
            animationEffect: 1, // CROSS_DISSOLVE
            allowsBackForwardNavigationGestures: false,
          },
        },
      });
    } catch (error) {
      console.error('Error opening InAppBrowser:', error);
    }
  }

  /**
   * Web fallback: open Instagram in a new window
   */
  private openWithWindowOpen(startUrl: string): void {
    // For web testing, open in same tab since we can't monitor cross-origin navigation
    window.location.href = startUrl;
  }

  /**
   * Handle URL navigation - validate and redirect if blocked
   */
  private async handleNavigationEvent(url: string): Promise<void> {
    const path = this.extractPath(url);

    if (!this.isAllowedRoute(path)) {
      const redirectTarget = this.getRedirectTarget(this.currentPath);
      const redirectUrl = `${this.INSTAGRAM_BASE}${redirectTarget}`;

      try {
        // Close current browser and reopen with redirect URL
        await InAppBrowser.close();
        await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay
        await this.openInstagram(); // This will load the last saved route
      } catch (error) {
        console.error('Error redirecting:', error);
      }
    } else {
      // Valid route, update current path
      this.currentPath = path;
      await this.persistRoute(path);
    }
  }

  /**
   * Validate if route is allowed
   */
  private isAllowedRoute(path: string): boolean {
    const lowerPath = path.toLowerCase();

    // Check for /accounts/login/ first
    if (
      lowerPath === '/accounts/login/' ||
      lowerPath.startsWith('/accounts/login/?') ||
      lowerPath.startsWith('/accounts/login/#')
    ) {
      return true;
    }

    // Check for /direct/
    if (
      lowerPath === '/direct/' ||
      lowerPath.startsWith('/direct/?') ||
      lowerPath.startsWith('/direct/#')
    ) {
      return true;
    }

    // Check for /p/ (with anything after)
    if (lowerPath.startsWith('/p/')) {
      return true;
    }

    // Check for /settings/
    if (
      lowerPath === '/settings/' ||
      lowerPath.startsWith('/settings/?') ||
      lowerPath.startsWith('/settings/#')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get intelligent redirect target based on current page
   */
  private getRedirectTarget(currentPath: string): string {
    const path = currentPath.toLowerCase();

    // If on /direct/, redirect blocked routes to /settings/
    if (path.startsWith('/direct/')) {
      return '/settings/';
    }

    // If on /settings/, redirect blocked routes to /direct/
    if (path.startsWith('/settings/')) {
      return '/direct/';
    }

    // If on /p/something, redirect blocked routes to /direct/
    if (path.startsWith('/p/')) {
      return '/direct/';
    }

    // If on login page, redirect to /direct/ after login
    if (path.startsWith('/accounts/login/')) {
      return '/direct/';
    }

    // Default fallback
    return '/direct/';
  }

  /**
   * Extract pathname from URL
   */
  private extractPath(fullUrl: string): string {
    try {
      const url = new URL(fullUrl);
      return url.pathname;
    } catch {
      return '/direct/'; // Fallback to /direct/ if URL parsing fails
    }
  }

  /**
   * Save current route to device storage
   */
  private async persistRoute(path: string): Promise<void> {
    try {
      await Preferences.set({
        key: this.PREF_KEY,
        value: path || '/direct/',
      });
    } catch (error) {
      console.error('Error persisting route:', error);
    }
  }

  /**
   * Restore last visited route from storage
   */
  private async getLastRoute(): Promise<string> {
    try {
      const result = await Preferences.get({ key: this.PREF_KEY });
      const route = result.value;

      // Validate stored route is still allowed
      if (route && this.isAllowedRoute(route)) {
        return route;
      }

      return '/direct/'; // Default if no valid stored route
    } catch (error) {
      console.error('Error retrieving last route:', error);
      return '/direct/'; // Default on error
    }
  }

  /**
   * Close the browser (cleanup)
   */
  async closeBrowser(): Promise<void> {
    try {
      await InAppBrowser.close();
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }
}

