<?php
/**
 * Plugin Name:       Asset Sweep – Remove Unused CSS & JS
 * Plugin URI:        https://octoolhouse.com/asset-sweep
 * Description:       Removes unused CSS and JavaScript from your site's front end — emojis, embeds, block library CSS, jQuery Migrate, dashicons, and any custom handles you choose. Great for Elementor and other page-builder sites.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.2
 * Author:            Steve Kinzey
 * Author URI:        https://octoolhouse.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       asset-sweep
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'ASSET_SWEEP_VERSION', '1.0.0' );
define( 'ASSET_SWEEP_OPTION', 'asset_sweep_settings' );

/**
 * Default settings.
 */
function asset_sweep_defaults() {
	return array(
		'disable_emojis'       => 0,
		'disable_embeds'       => 0,
		'remove_block_css'     => 0,
		'remove_global_styles' => 0,
		'remove_jquery_migrate'=> 0,
		'remove_dashicons'     => 0,
		'debug_mode'           => 0,
		'custom_styles'        => '',
		'custom_scripts'       => '',
	);
}

/**
 * Get merged settings.
 */
function asset_sweep_get_settings() {
	$saved = get_option( ASSET_SWEEP_OPTION, array() );
	if ( ! is_array( $saved ) ) {
		$saved = array();
	}
	return wp_parse_args( $saved, asset_sweep_defaults() );
}

/**
 * Turn a textarea of handles (one per line) into a clean array.
 */
function asset_sweep_parse_handles( $raw ) {
	$handles = array();
	foreach ( preg_split( '/[\r\n,]+/', (string) $raw ) as $line ) {
		$line = trim( $line );
		if ( '' !== $line ) {
			$handles[] = sanitize_key( $line );
		}
	}
	return array_unique( $handles );
}

/* -------------------------------------------------------------------------
 * Front-end optimizations
 * ---------------------------------------------------------------------- */

/**
 * Disable emojis.
 */
add_action( 'init', function () {
	$settings = asset_sweep_get_settings();
	if ( empty( $settings['disable_emojis'] ) ) {
		return;
	}
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	remove_action( 'admin_print_scripts', 'print_emoji_detection_script' );
	remove_action( 'admin_print_styles', 'print_emoji_styles' );
	remove_filter( 'the_content_feed', 'wp_staticize_emoji' );
	remove_filter( 'comment_text_rss', 'wp_staticize_emoji' );
	remove_filter( 'wp_mail', 'wp_staticize_emoji_for_email' );
	add_filter( 'tiny_mce_plugins', function ( $plugins ) {
		return is_array( $plugins ) ? array_diff( $plugins, array( 'wpemoji' ) ) : array();
	} );
	add_filter( 'wp_resource_hints', function ( $urls, $relation_type ) {
		if ( 'dns-prefetch' === $relation_type ) {
			$emoji_url = apply_filters( 'emoji_svg_url', 'https://s.w.org/images/core/emoji/' );
			foreach ( $urls as $key => $url ) {
				$href = is_array( $url ) && isset( $url['href'] ) ? $url['href'] : $url;
				if ( is_string( $href ) && false !== strpos( $href, 's.w.org' ) ) {
					unset( $urls[ $key ] );
				}
			}
		}
		return $urls;
	}, 10, 2 );
} );

/**
 * Remove jQuery Migrate.
 */
add_action( 'wp_default_scripts', function ( $scripts ) {
	$settings = asset_sweep_get_settings();
	if ( empty( $settings['remove_jquery_migrate'] ) ) {
		return;
	}
	if ( ! is_admin() && isset( $scripts->registered['jquery'] ) ) {
		$scripts->registered['jquery']->deps = array_diff(
			$scripts->registered['jquery']->deps,
			array( 'jquery-migrate' )
		);
	}
} );

/**
 * Main front-end dequeue pass. Priority 100 so it runs after
 * themes and plugins have enqueued their assets.
 */
add_action( 'wp_enqueue_scripts', function () {
	$settings = asset_sweep_get_settings();

	// Block library CSS (safe when the front end is built with a page
	// builder such as Elementor rather than Gutenberg blocks).
	if ( ! empty( $settings['remove_block_css'] ) ) {
		wp_dequeue_style( 'wp-block-library' );
		wp_dequeue_style( 'wp-block-library-theme' );
		wp_dequeue_style( 'classic-theme-styles' );
	}

	// Global styles from theme.json.
	if ( ! empty( $settings['remove_global_styles'] ) ) {
		wp_dequeue_style( 'global-styles' );
	}

	// Dashicons for logged-out visitors.
	if ( ! empty( $settings['remove_dashicons'] ) && ! is_user_logged_in() ) {
		wp_dequeue_style( 'dashicons' );
		wp_deregister_style( 'dashicons' );
	}

	// Embeds script.
	if ( ! empty( $settings['disable_embeds'] ) ) {
		wp_dequeue_script( 'wp-embed' );
		wp_deregister_script( 'wp-embed' );
	}

	// Custom handles.
	foreach ( asset_sweep_parse_handles( $settings['custom_styles'] ) as $handle ) {
		wp_dequeue_style( $handle );
	}
	foreach ( asset_sweep_parse_handles( $settings['custom_scripts'] ) as $handle ) {
		wp_dequeue_script( $handle );
	}
}, 100 );

/**
 * Global styles: on classic (non-block) themes, WordPress enqueues the
 * 'global-styles' handle in the footer (wp_footer priority 1), after the
 * main dequeue pass has already run. Dequeue again just before footer
 * styles are printed so the option works on classic themes too.
 */
add_action( 'wp_footer', function () {
	$settings = asset_sweep_get_settings();
	if ( ! empty( $settings['remove_global_styles'] ) ) {
		wp_dequeue_style( 'global-styles' );
	}
}, 2 );

/**
 * Extra embed disabling (rewrite rules / discovery links).
 */
add_action( 'init', function () {
	$settings = asset_sweep_get_settings();
	if ( empty( $settings['disable_embeds'] ) ) {
		return;
	}
	remove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
	remove_action( 'wp_head', 'wp_oembed_add_host_js' );
	add_filter( 'embed_oembed_discover', '__return_false' );
	remove_filter( 'oembed_dataparse', 'wp_filter_oembed_result', 10 );
}, 9999 );

/**
 * Debug mode: print enqueued handles for administrators.
 */
add_action( 'wp_footer', function () {
	$settings = asset_sweep_get_settings();
	if ( empty( $settings['debug_mode'] ) || ! current_user_can( 'manage_options' ) ) {
		return;
	}
	global $wp_scripts, $wp_styles;
	echo "\n<!-- ASSET SWEEP DEBUG - ENQUEUED SCRIPTS:\n";
	foreach ( (array) $wp_scripts->queue as $handle ) {
		if ( isset( $wp_scripts->registered[ $handle ] ) ) {
			echo esc_html( $handle . ' => ' . $wp_scripts->registered[ $handle ]->src ) . "\n";
		}
	}
	echo "\nENQUEUED STYLES:\n";
	foreach ( (array) $wp_styles->queue as $handle ) {
		if ( isset( $wp_styles->registered[ $handle ] ) ) {
			echo esc_html( $handle . ' => ' . $wp_styles->registered[ $handle ]->src ) . "\n";
		}
	}
	echo "-->\n";
}, 9999 );

/* -------------------------------------------------------------------------
 * Admin: settings page
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', function () {
	add_options_page(
		__( 'Asset Sweep', 'asset-sweep' ),
		__( 'Asset Sweep', 'asset-sweep' ),
		'manage_options',
		'asset-sweep',
		'asset_sweep_render_settings_page'
	);
} );

add_action( 'admin_init', function () {
	register_setting( 'asset_sweep_group', ASSET_SWEEP_OPTION, array(
		'type'              => 'array',
		'sanitize_callback' => 'asset_sweep_sanitize',
		'default'           => asset_sweep_defaults(),
	) );
} );

/**
 * Sanitize settings on save.
 */
function asset_sweep_sanitize( $input ) {
	$defaults = asset_sweep_defaults();
	$clean    = array();
	if ( ! is_array( $input ) ) {
		$input = array();
	}
	foreach ( $defaults as $key => $default ) {
		if ( in_array( $key, array( 'custom_styles', 'custom_scripts' ), true ) ) {
			$clean[ $key ] = isset( $input[ $key ] ) ? sanitize_textarea_field( $input[ $key ] ) : '';
		} else {
			$clean[ $key ] = empty( $input[ $key ] ) ? 0 : 1;
		}
	}
	return $clean;
}

/**
 * Render the settings page.
 */
function asset_sweep_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$settings = asset_sweep_get_settings();

	$toggles = array(
		'disable_emojis'        => array(
			__( 'Disable emojis', 'asset-sweep' ),
			__( 'Removes the emoji detection script and styles WordPress loads on every page. Safe for virtually all sites.', 'asset-sweep' ),
		),
		'disable_embeds'        => array(
			__( 'Disable embeds', 'asset-sweep' ),
			__( 'Removes the wp-embed script and oEmbed discovery links. Safe unless you embed your own posts on other sites.', 'asset-sweep' ),
		),
		'remove_block_css'      => array(
			__( 'Remove block library CSS', 'asset-sweep' ),
			__( 'Removes Gutenberg block styles. Recommended for Elementor, Divi, and other page-builder sites that do not use blocks on the front end.', 'asset-sweep' ),
		),
		'remove_global_styles'  => array(
			__( 'Remove global styles (theme.json)', 'asset-sweep' ),
			__( 'Removes inline global styles. Test carefully — some themes rely on these even with a page builder.', 'asset-sweep' ),
		),
		'remove_jquery_migrate' => array(
			__( 'Remove jQuery Migrate', 'asset-sweep' ),
			__( 'Drops the legacy jQuery Migrate script. Safe on modern themes — test forms and sliders after enabling.', 'asset-sweep' ),
		),
		'remove_dashicons'      => array(
			__( 'Remove dashicons for visitors', 'asset-sweep' ),
			__( 'Removes the dashicons icon font for logged-out visitors only. The admin bar keeps working for logged-in users.', 'asset-sweep' ),
		),
		'debug_mode'            => array(
			__( 'Debug mode', 'asset-sweep' ),
			__( 'Prints all enqueued script/style handles in an HTML comment at the bottom of pages — visible only to administrators via View Source. Use this to find handles for the custom lists below.', 'asset-sweep' ),
		),
	);
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Asset Sweep – Remove Unused CSS & JS', 'asset-sweep' ); ?></h1>
		<p><?php esc_html_e( 'Enable one option at a time and check your site after each change. Clear any caching plugin between tests.', 'asset-sweep' ); ?></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'asset_sweep_group' ); ?>
			<table class="form-table" role="presentation">
				<?php foreach ( $toggles as $key => $labels ) : ?>
					<tr>
						<th scope="row"><?php echo esc_html( $labels[0] ); ?></th>
						<td>
							<label>
								<input type="checkbox"
									name="<?php echo esc_attr( ASSET_SWEEP_OPTION . '[' . $key . ']' ); ?>"
									value="1" <?php checked( ! empty( $settings[ $key ] ) ); ?> />
								<?php echo esc_html( $labels[1] ); ?>
							</label>
						</td>
					</tr>
				<?php endforeach; ?>
				<tr>
					<th scope="row"><?php esc_html_e( 'Custom style handles to remove', 'asset-sweep' ); ?></th>
					<td>
						<textarea name="<?php echo esc_attr( ASSET_SWEEP_OPTION . '[custom_styles]' ); ?>"
							rows="4" cols="50" class="large-text code"
							placeholder="contact-form-7&#10;some-plugin-style"><?php echo esc_textarea( $settings['custom_styles'] ); ?></textarea>
						<p class="description"><?php esc_html_e( 'One handle per line. Find handles with Debug mode above.', 'asset-sweep' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Custom script handles to remove', 'asset-sweep' ); ?></th>
					<td>
						<textarea name="<?php echo esc_attr( ASSET_SWEEP_OPTION . '[custom_scripts]' ); ?>"
							rows="4" cols="50" class="large-text code"
							placeholder="contact-form-7&#10;some-plugin-script"><?php echo esc_textarea( $settings['custom_scripts'] ); ?></textarea>
						<p class="description"><?php esc_html_e( 'One handle per line. Removed site-wide on the front end.', 'asset-sweep' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

/**
 * Settings link on the Plugins screen.
 */
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	$url = admin_url( 'options-general.php?page=asset-sweep' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'asset-sweep' ) . '</a>' );
	return $links;
} );
