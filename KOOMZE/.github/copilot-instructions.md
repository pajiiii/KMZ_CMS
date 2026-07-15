# KOOMZE Website Development Guide

## Project Overview
This is a static HTML website for KOOMZE (科曼者), a gaming peripherals company. The site showcases products (keyboards, mice, headsets) and provides driver downloads. Features include dark/light mode toggle, multi-language support (Simplified Chinese, Traditional Chinese, English), product filtering, and tabbed navigation.

## Architecture
- **Single-page application**: All code is in `Main.html` with inline CSS and JavaScript
- **No build system**: Pure static HTML/CSS/JS
- **Theming**: CSS custom properties with mode attribute on `<html>`
- **Internationalization**: Language classes with CSS display toggling

## Key Conventions
- **Inline styles/scripts**: Keep CSS and JS embedded in HTML for simplicity
- **Multi-language content**: Use `.lang-zh`, `.lang-tw`, `.lang-en` classes for each text element
- **Data attributes**: Use `data-cat` for product categories
- **Vanilla JavaScript**: No external libraries or frameworks

## Development Workflow
- **Edit Main.html**: All changes happen in this single file
- **Test locally**: Open in browser or use VS Code Live Server
- **No dependencies**: No package managers or build tools needed

## Common Tasks
- **Add products**: Add `<div class="product" data-cat="category">` with image and name
- **Add languages**: Include three `<span class="lang-*">` for each text element
- **Update drivers**: Modify driver list in `#driverPage` section
- **Change theme**: Edit CSS custom properties in `:root` and `:root[mode="light"]`

## Pitfalls to Avoid
- **Broken links**: Check that `product.html`, `driver1.zip`, `driver2.zip` exist or remove references
- **Incomplete features**: Search input has UI but no functionality - implement or remove
- **Image consistency**: Use consistent naming and ensure all referenced images exist
- **Language coverage**: Always provide all three language versions for new content

## Assets
- Logo: `KOOMZE.png`
- Product images: `1.JPG`, `2.jpg`, `6.jpg` (currently placeholder images)

This is a prototype website - focus on completing placeholder features and ensuring all links/images work before production.</content>
<parameter name="filePath">d:\desktop\study\KOOMZE\.github\copilot-instructions.md