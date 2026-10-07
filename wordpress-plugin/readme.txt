=== Asset Sweep - Remove Unused CSS & JS ===
Contributors: skamerica
Tags: performance, unused css, unused javascript, dequeue, page speed
Requires at least: 5.8
Tested up to: 7.0
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Remove unused CSS and JavaScript from your site's front end with simple toggles. Great for Elementor and other page-builder sites.

== Description ==

Asset Sweep gives you a simple settings page with one toggle per optimization, so you can remove the CSS and JavaScript your site doesn't need — one change at a time, safely.

**What it can remove:**

* WordPress emoji script and styles
* wp-embed script and oEmbed discovery links
* Gutenberg block library CSS (recommended for Elementor, Divi, and other page-builder sites)
* Global styles from theme.json
* jQuery Migrate
* Dashicons for logged-out visitors
* Any custom style or script handle you list (site-wide)

**Debug mode** prints every enqueued script and style handle in an HTML comment at the bottom of your pages (visible only to administrators via View Source), so you can find exactly which handles to remove.

All optimizations apply only to the front end — your WordPress admin is never touched.

== Installation ==

1. Upload the `asset-sweep` folder to `/wp-content/plugins/`, or install the zip via Plugins → Add New → Upload Plugin.
2. Activate the plugin through the Plugins screen.
3. Go to Settings → Asset Sweep and enable optimizations one at a time, checking your site after each change.

== Frequently Asked Questions ==

= Is this safe for Elementor sites? =

Yes — that's the primary use case. Elementor doesn't use Gutenberg block CSS on the front end, so "Remove block library CSS" is typically safe there. Always test after enabling each option.

= Will this break my site? =

Each optimization is off by default and can be turned off again at any time. Enable one option at a time and check your pages. If anything looks wrong, just untoggle it.

= How do I find which handles to remove? =

Enable Debug mode, visit any front-end page while logged in as an administrator, and use View Source. You'll see a comment at the bottom listing every enqueued script and style handle with its source URL.

= Does it change my database or files? =

It stores one small settings option. Uninstalling the plugin deletes it. No files are modified.

== Screenshots ==

1. The Asset Sweep settings page — one toggle per optimization, plus custom handle lists and debug mode.

== Changelog ==

= 1.0.0 =
* Initial release: emoji, embed, block CSS, global styles, jQuery Migrate, and dashicons removal; custom handle lists; debug mode.
