# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-08-15

### Added

#### WordPress Plugin
- Settings page with toggles for each optimization
- Remove WordPress emoji script and styles
- Remove wp-embed script and oEmbed discovery links
- Remove Gutenberg block library CSS
- Remove global styles from theme.json
- Remove jQuery Migrate
- Remove dashicons for logged-out visitors
- Custom style and script handle removal
- Debug mode showing all enqueued handles
- Admin settings page at Settings → Asset Sweep
- Uninstall cleanup removing stored options

#### CLI Tool
- `asset-sweep analyze` command for detecting unused CSS and JS
- Configuration via `.asset-sweep.json`
- JSON and text output formats
- Integration-ready exit codes

#### Documentation
- Comprehensive README with use cases and performance data
- Contributing guidelines with code style standards
- Code of Conduct based on Contributor Covenant
- About page explaining philosophy and approach

### Initial Release
- v1.0.0 ready for production use
- Tested on WordPress 5.8 through 7.0
- Compatible with Elementor, Divi, and standard Gutenberg
- Safe for high-traffic sites
