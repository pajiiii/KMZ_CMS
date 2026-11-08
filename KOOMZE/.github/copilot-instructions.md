# KOOMZE Website Development Guide

## Project Overview
KOOMZE (科曼者) uses HTML/CSS/JavaScript pages served by an Express backend. MongoDB stores product, carousel, driver and social-account records. Uploaded files live in `BackEnd/uploads`; records store their URLs. The site uses a light theme and supports Simplified Chinese, Traditional Chinese and English.

## Architecture
- `Main.html`: homepage carousels and featured products.
- `Product.html`: product filtering/search and driver support.
- `product-detail.html`: product images, colors, introduction and three purchase links.
- `common.js` / `common.css`: shared navigation, language behavior, load states and rich-text filtering.
- `../BackEnd/admin.html`: content management and uploads; Quill is loaded from its configured CDN.
- `../BackEnd/server.js`: Express setup, authentication and static-resource boundaries.
- `../BackEnd/routes/content.js` and `models/`: content APIs and Mongoose schemas.
- No frontend build step is configured. Backend dependencies are declared in `BackEnd/package.json`.

## Key Conventions
- **Existing files**: Preserve filenames and asset URLs; prefer focused changes in the existing structure.
- **Multi-language content**: Use `.lang-zh`, `.lang-tw`, `.lang-en` classes for each text element
- **Database content**: Manage products and drivers through admin/API; do not hardcode product lists into pages.
- **HTML output**: Use `escapeHTML` for text/attributes and `sanitizeRichText` for product introductions. HTML escaping alone does not validate URL protocols.
- **Empty/error states**: Empty arrays show empty states; failed requests show errors. Do not substitute demo products.
- **Small carousel**: One region-wide switch in admin controls homepage mini-carousel visibility. It defaults off and is stored separately in MongoDB (`home_mini_carousel_settings`, `_id: global`). `GET/PUT /api/content/home-mini-carousel/settings` reads/saves it. A disabled, empty or failed small carousel stays hidden; existing item/image records remain intact. The large carousel has independent behavior.
- **Drivers**: `hasClient` / `hasWeb` control availability. Missing legacy flags are inferred from URLs. Disabling a channel retains its stored URL/file.

## Development Workflow
- Run from `BackEnd` with `node server.js` after dependencies and environment variables are configured. Use the backend origin for frontend testing so `/api/content` and `/uploads` resolve correctly.
- Environment configuration is read from `BackEnd/.env`, with the repository-root `.env` as a fallback. Keep secrets out of commits.
- Verify syntax and the affected behavior; this repository does not currently define an npm test script.

## Common Tasks
- **Add products**: Create the base product, then associate tags, carousel entries and detail records through `productId` in admin.
- **Add languages**: Include three `<span class="lang-*">` for each text element
- **Update drivers**: Edit the MongoDB-backed driver record through admin, including availability switches and URLs.
- **Purchase links**: Frontend displays `buyLink1` (Taobao), `buyLink2` (JD) and `buyLink3` (Douyin). `buyLink4` and `buyLink5` remain stored and editable in admin.
- **Change colors**: Edit CSS custom properties in `common.css`.

## Pitfalls to Avoid
- **Shared uploads**: Record deletion must succeed before cleanup. Check all content collections for references and retain files if the check fails.
- **Async forms**: Ignore late list/edit/upload responses after a tab or record change.
- **Product IDs**: Associations use `productId` strings; changing an ID requires checking its existing associations.
- **Resources**: Preserve existing image and driver addresses. Do not expose the backend source directory as static content.
- **Language coverage**: Always provide all three language versions for new content

## Assets
- Frontend assets: `Pictures/`, `favicon.png`, `KOOMZE.png` and `KOOMZE_START.png`.
- Uploaded assets: URLs under `/uploads/`, backed by `BackEnd/uploads/`.
