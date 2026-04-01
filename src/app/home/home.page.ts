import { Component, OnInit } from '@angular/core';
import { InstagramRedirectService } from '../services/instagram-redirect.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  constructor(private instagramService: InstagramRedirectService) {}

  async ngOnInit(): Promise<void> {
    // Auto-launch Instagram in InAppBrowser
    await this.instagramService.openInstagram();
  }
}
