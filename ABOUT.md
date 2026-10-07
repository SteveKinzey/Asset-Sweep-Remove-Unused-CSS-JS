# About Asset Sweep

## The Problem

Modern WordPress and web projects carry a lot of cargo they don't actually use:

- WordPress emoji script (14 KB) and styles loaded on every page
- Gutenberg's block library CSS (22 KB) even if you're using Elementor
- jQuery Migrate (9 KB) for sites that never use the old jQuery API
- Dashicons (40 KB) showing to users who aren't logged in
- Embeds script and oEmbed discovery links nobody touches

**That's 88 KB** of uncompressed, render-blocking assets on a typical page—20–50ms of page load time your visitors don't have.

## The Solution

Asset Sweep is a simple, safe settings page with one toggle per optimization. You control exactly what gets removed. Nothing happens until you enable it. You can roll back in seconds.

## Philosophy

**One change at a time.** Enable one optimization, test your site, move to the next. This builds confidence and makes debugging trivial.

**Off by default.** Nothing breaks until you turn it on. The default config is safe for any site.

**No destructive changes.** Stores one option. Uninstall and everything reverts to normal.

**Admin untouched.** Front end only. Your WordPress admin dashboard is always fully functional.

## Use Cases

### Elementor Sites
Elementor sites run their own CSS and don't need Gutenberg's block library. Removing block CSS (22 KB) is often a quick win.

### High-Traffic Sites
Removing unused assets compounds across millions of page loads. Even 20 ms saved per load adds up to hours per day.

### Mobile-First Projects
On mobile networks, cutting 88 KB can mean the difference between 3G load in 2s vs. 4s.

### Performance-Conscious Teams
When Core Web Vitals matter, every kilobyte counts. Asset Sweep finds the easy wins.

## Technical Approach

Asset Sweep uses WordPress's native dequeue system (`wp_dequeue_script`, `wp_dequeue_style`) hooked to `wp_enqueue_scripts`. No hacks, no regex, no fragile DOM manipulation. Just WordPress doing what it's designed to do.

Each optimization is a separate hook so failures are isolated.

Debug mode prints the full list of enqueued handles as an HTML comment—only admins see it.

## Why Not Just Disable It in My Theme?

You could. Asset Sweep just makes it easier and safer to do, with a settings page instead of editing code.
