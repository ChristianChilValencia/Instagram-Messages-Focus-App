# 📱 Instagram Messages Focus App

A mobile app that strips away the distractions and transforms Instagram into a clean, messaging-only experience.

## 💭 The Story Behind This Project

Instagram's main feed is designed to be addictive—endless scrolling, reels, stories, and explore tabs all competing for your attention. But I actually *need* Instagram for staying connected with friends through Direct Messages.

So I thought: *what if I could strip away all the noise and keep just the messaging experience?*

That's where this app comes in. It lets you transform Instagram into a focused messaging platform, removing all the temptations that pull you away from genuine conversations.

## ✨ Features

- **💬 Messaging-Only Experience** - See only your Instagram's Messages and your settings only
- **🗑️ Hide Feeds & Distractions** - Reroutes you away from your main feed, Reels, Stories, and Explore sections
- **🔒 Privacy-Focused** - All settings stored locally on your device

## 📦 Installation

### For Everyone (Using APK)
**👉 This is the easiest way! No technical knowledge required.**

1. Download `Instagram-Messages-Focus-App.apk`
2. On your Android phone, open the file to install
3. Tap **Install** when prompted
4. Done! The app is now ready to use on your home screen

### For Developers (Building from Source - Android)

1. Clone or download this repository
2. Build for Android:
   ```bash
   ionic build
   npx cap sync android
   npx cap open android
   ```
3. Use Android Studio to build and run on your device or emulator
4. Follow Android's standard app installation process

## 🚀 Usage

1. Open the Instagram Messages Focus App
2. Log in with your Instagram credentials
3. Toggle the features to customize your experience:
   - **Hide Feed** - Removes the main feed
   - **Hide Stories** - Removes stories from view
   - **Hide Explore** - Removes the explore section
4. Focus on your Direct Messages without distractions!

## 🛠️ Development

Built with:
- **Ionic Framework** - For cross-platform mobile development
- **Angular** - For robust application architecture
- **Capacitor** - For native plugin access
- **TypeScript** - For type-safe code

### Project Structure
```
src/
├── app/           # Angular components and services
├── assets/        # Static assets and images
├── environments/  # Environment configuration
├── theme/         # Global styles and theming
├── global.scss    # Global styles
├── main.ts        # App entry point
└── index.html     # HTML template

android/          # Android native code
www/              # Built web assets
```

### Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   ionic serve
   ```

3. Build for production:
   ```bash
   ionic build --prod
   ```

## ⚠️ Disclaimer

This is a personal project and not affiliated with Meta/Facebook/Instagram. Use responsibly and be aware that website updates from Meta may affect the extension's functionality.

## 📝 License

This project is open source and available under the MIT License.

---

## 👨‍💻 Built By

Developed by **Christian Valencia** 

**ValAid**: *A ValAid solution might be your valid solution*

---
