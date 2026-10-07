<?php
/**
 * Uninstall handler for Asset Sweep.
 * Removes the plugin's settings from the database.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'asset_sweep_settings' );
