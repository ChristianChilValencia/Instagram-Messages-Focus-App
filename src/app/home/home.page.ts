import { Component, OnInit } from '@angular/core';
import { App } from '@capacitor/app';
import { InstagramRedirectService } from '../services/instagram-redirect.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  constructor(private instagramService: InstagramRedirectService) {}

  async ngOnInit(): Promise<void> {
    // Keep app from navigating to the blank host page.
    App.addListener('backButton', async () => {
      await this.instagramService.ensureBrowserOpen();
    });

    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        await this.instagramService.ensureBrowserOpen();
      }
    });

    // Auto-launch Instagram in InAppBrowser
    await this.instagramService.openInstagram();
  }

  async ionViewDidEnter(): Promise<void> {
    await this.instagramService.ensureBrowserOpen();
  }
}
