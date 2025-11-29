# Public Assets

This folder contains static assets that will be copied to the build output.

## Current Assets

- **icons/** - PWA icons and favicons
  - icon-192.png, icon-512.png - Standard PWA icons
  - icon-192-maskable.png, icon-512-maskable.png - Maskable icons for adaptive display
  - apple-touch-icon.png - iOS home screen icon
  - favicon.ico - Browser favicon

## Note

Do NOT place `index.html` or any build outputs here. 
Vite manages the build process and outputs to the `dist/` folder, which Firebase Hosting uses for deployment.
